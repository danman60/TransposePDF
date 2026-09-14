#!/usr/bin/env python3
"""Persistent workspace E2E against a real running TransposePDF server."""

import json
import os
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright


URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000").rstrip("/")
ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts" / "e2e"


def api_json(path):
    with urllib.request.urlopen(f"{URL}{path}", timeout=10) as response:
        if response.status != 200:
            raise AssertionError(f"GET {path} returned {response.status}")
        return json.load(response)


def forbidden_payload_fields(value, location="root"):
    forbidden = {"source", "rawanalysis", "transcript", "path", "media"}
    findings = []
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = str(key).lower()
            if normalized in forbidden:
                findings.append(f"{location}.{key}")
            findings.extend(forbidden_payload_fields(child, f"{location}.{key}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            findings.extend(forbidden_payload_fields(child, f"{location}[{index}]"))
    return findings


def wait_for_library(page, count=3):
    page.wait_for_function(
        "count => document.querySelectorAll('#activeSongSelect option').length === count",
        arg=count,
    )


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    console_errors = []
    page_errors = []
    telemetry_http_failures = []
    results = {}

    with tempfile.TemporaryDirectory(prefix="transposepdf-e2e-profile-") as profile, sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            profile,
            headless=True,
            accept_downloads=True,
            viewport={"width": 1440, "height": 900},
            chromium_sandbox=False,
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        def capture_telemetry(response):
            if "/api/telemetry/events" in response.url and not 200 <= response.status < 300:
                telemetry_http_failures.append(f"{response.status} {response.url}")

        page.on("response", capture_telemetry)
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.initialized !== false && window.transposeApp?.libraryStore")
        session_id = page.evaluate("window.transposeApp.telemetry.sessionId")

        long_alpha = "\n".join(
            line
            for number in range(1, 91)
            for line in ("C        G", f"Alpha exact lyric {number}")
        )
        fixtures = (
            ("Alpha", long_alpha),
            ("Beta", "D A\nBeta exact lyric"),
            ("Gamma", "E B\nGamma exact lyric"),
        )
        for title, content in fixtures:
            page.locator("#createChartButton").click()
            page.locator("#authorTitle").fill(title)
            page.locator("#authorContent").fill(content)
            page.locator("#saveChartButton").click()
            page.wait_for_timeout(250)

        page.locator("#sessionName").fill("Persistent E2E Set")
        page.wait_for_timeout(700)
        page.reload(wait_until="domcontentloaded")
        wait_for_library(page)
        results["three_song_reload"] = page.locator("#activeSongSelect option").all_text_contents() == [
            "Alpha · C", "Beta · C", "Gamma · C"
        ]
        results["single_chart"] = page.locator("#songsContainer .lead-sheet").count() == 1
        results["session_name"] = page.locator("#sessionName").input_value() == "Persistent E2E Set"

        page.locator("#songSelectorList button", has_text="Alpha").click()
        page.evaluate("window.scrollTo(0, document.body.scrollHeight * 0.55)")
        page.wait_for_timeout(150)
        results["sticky_edit"] = page.locator(".edit-song-button").evaluate(
            "el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }"
        )
        page.screenshot(path=str(ARTIFACTS / "persistent-workspace-desktop.png"))
        page.locator(".edit-song-button").click()
        results["exact_editor"] = page.locator(
            '.lead-sheet [data-inline-field="lyrics"]'
        ).first.evaluate("el => el.isContentEditable && document.activeElement === el")

        page.locator(".spelling-policy").select_option("flats")
        page.reload(wait_until="domcontentloaded")
        wait_for_library(page)
        results["immediate_spelling_reload"] = page.locator(".spelling-policy").input_value() == "flats"

        page.locator("[data-action='transpose-song'][data-semitones='1']").click()
        page.locator("[data-action='transpose-song'][data-semitones='1']").click()
        page.reload(wait_until="domcontentloaded")
        wait_for_library(page)
        results["rapid_transpose_reload"] = page.evaluate(
            "() => { const s = window.transposeApp.currentSongs.find(x => String(x.id) === String(window.transposeApp.activeSongId)); return s.transposition === 2 && s.currentKey === 'D'; }"
        ) and page.locator(".sidebar-transpose output").text_content().strip().startswith("+2")

        # Leave durable semantic evidence after proving immediate-navigation persistence.
        page.locator(".spelling-policy").select_option("sharps")
        page.locator(".spelling-policy").select_option("flats")
        page.locator("[data-action='transpose-song'][data-semitones='-1']").click()
        page.locator("[data-action='transpose-song'][data-semitones='1']").click()
        page.wait_for_timeout(700)

        page.evaluate("window.transposeApp.openAuthoring(window.transposeApp.activeSongId)")
        recovered_text = page.locator("#authorContent").input_value() + "\nC\nRECOVERY E2E EXACT"
        page.locator("#authorContent").fill(recovered_text)
        page.wait_for_timeout(900)
        page.reload(wait_until="domcontentloaded")
        page.locator("#recoveryBanner").wait_for(state="visible", timeout=3_000)
        results["recovery_offered"] = page.locator("#recoveryBanner").is_visible()
        page.locator("#restoreDraftButton").click()
        results["recovery_exact"] = page.locator("#authorContent").input_value() == recovered_text
        page.locator("#saveChartButton").click()

        page.locator("#exportButton").click()
        with page.expect_download() as download_info:
            page.locator("#exportFinalButton").click()
        download = download_info.value
        export_path = Path(profile) / "persistent-session.pdf"
        download.save_as(export_path)
        results["export"] = export_path.stat().st_size > 1000

        page.set_viewport_size({"width": 375, "height": 812})
        gamma_value = page.locator("#activeSongSelect option", has_text="Gamma").get_attribute("value")
        page.locator("#activeSongSelect").select_option(gamma_value)
        results["mobile"] = (
            page.locator("#activeSongSelect").is_visible()
            and page.locator("#songsContainer .lead-sheet").count() == 1
            and page.locator("#activeSongSelect option:checked").text_content().startswith("Gamma")
            and page.locator("#songToolsToggle").is_visible()
        )
        page.screenshot(path=str(ARTIFACTS / "persistent-workspace-mobile.png"))
        page.locator("#songToolsToggle").click()
        assert page.locator("#songLibrarySidebar").is_visible()
        page.screenshot(path=str(ARTIFACTS / "persistent-workspace-mobile-tools.png"))
        page.locator("#songToolsClose").click()
        page.locator('.lead-sheet [data-inline-field="lyrics"]').first.click()
        results["mobile_edit"] = page.locator(
            '.lead-sheet [data-inline-field="lyrics"]'
        ).first.evaluate("el => el.isContentEditable && document.activeElement === el")
        page.wait_for_timeout(700)

        state = api_json("/api/telemetry/state?sessionId=" + urllib.parse.quote(session_id))
        events = api_json("/api/telemetry/events?sessionId=" + urllib.parse.quote(session_id) + "&limit=500")
        event_types = {event.get("eventType") for event in events.get("events", [])}
        required_events = {"chart.saved", "editor.opened", "editor.changed", "spelling.changed", "transpose.changed", "export.completed"}
        results["telemetry_events"] = required_events <= event_types
        results["telemetry_state"] = state.get("snapshot", {}).get("clientRevision", 0) > 0
        redaction_findings = forbidden_payload_fields(state) + forbidden_payload_fields(events)
        results["telemetry_redaction"] = not redaction_findings
        results["telemetry_http"] = not telemetry_http_failures
        results["console"] = not console_errors and not page_errors
        context.close()

    failures = [name for name, passed in results.items() if not passed]
    report = {
        "url": URL,
        "sessionId": session_id,
        "passed": len(results) - len(failures),
        "total": len(results),
        "failures": failures,
        "results": results,
        "consoleErrors": console_errors,
        "pageErrors": page_errors,
        "telemetryHttpFailures": telemetry_http_failures,
        "redactionFindings": redaction_findings,
    }
    print(json.dumps(report, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
