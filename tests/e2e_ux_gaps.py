#!/usr/bin/env python3
"""Targeted real-browser checks for performance gestures and readable history diffs."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.goto(BASE_URL, wait_until="networkidle")

    gesture = page.evaluate("""async () => {
      const songs = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
      let active = 'two';
      const reasons = [];
      const controller = new PerformanceController({
        getSongs: () => songs,
        getActiveSongId: () => active,
        selectSong: id => { active = id; },
        render: (_state, reason) => reasons.push(reason),
        reducedMotion: true
      });
      const surface = document.createElement('div');
      const button = document.createElement('button');
      surface.append(button);
      document.body.append(surface);
      controller.bindGestureSurface(surface);
      const touch = (target, type, x, y) => target.dispatchEvent(new TouchEvent(type, {
        bubbles: true, changedTouches: [new Touch({ identifier: 1, target, clientX: x, clientY: y })]
      }));
      touch(surface, 'touchstart', 320, 200); touch(surface, 'touchend', 220, 210);
      await new Promise(resolve => setTimeout(resolve));
      const afterLeft = active;
      touch(surface, 'touchstart', 100, 200); touch(surface, 'touchend', 185, 205);
      await new Promise(resolve => setTimeout(resolve));
      const afterRight = active;
      touch(surface, 'touchstart', 300, 200); touch(surface, 'touchend', 260, 205);
      await new Promise(resolve => setTimeout(resolve));
      const afterShort = active;
      touch(button, 'touchstart', 300, 200); touch(button, 'touchend', 180, 205);
      await new Promise(resolve => setTimeout(resolve));
      return { afterLeft, afterRight, afterShort, afterInteractive: active, reasons };
    }""")
    assert gesture["afterLeft"] == "three", gesture
    assert gesture["afterRight"] == "two", gesture
    assert gesture["afterShort"] == "two", gesture
    assert gesture["afterInteractive"] == "two", gesture

    diff = page.evaluate("""() => {
      const host = document.createElement('div');
      const fake = {
        elements: { historyPreview: host },
        escapeHtml: UIController.prototype.escapeHtml,
        lineDiff: UIController.prototype.lineDiff
      };
      UIController.prototype.previewHistory.call(fake,
        { title: 'Song', sections: [{ lines: [{ lyrics: 'Alpha' }, { lyrics: 'Old' }] }] },
        { revision: 2, label: 'Before bridge', song: { title: 'Song', sections: [{ lines: [{ lyrics: 'Alpha' }, { lyrics: 'New' }] }] } }
      );
      return {
        added: [...host.querySelectorAll('.diff-line--added')].map(node => node.textContent),
        removed: [...host.querySelectorAll('.diff-line--removed')].map(node => node.textContent),
        unchanged: host.querySelectorAll('.diff-line--unchanged').length,
        aria: host.querySelector('.history-diff')?.getAttribute('aria-label')
      };
    }""")
    assert any("New" in line for line in diff["added"]), diff
    assert any("Old" in line for line in diff["removed"]), diff
    assert diff["unchanged"] >= 1, diff
    assert diff["aria"] == "Line changes", diff
    page.evaluate("""() => {
      document.getElementById('historyDrawer').hidden = false;
      document.getElementById('historyHeading').textContent = 'Armor of God — Versions';
      document.getElementById('historyList').innerHTML = '<article class="history-item"><button><strong>Before bridge edit</strong><span>Sep 13, 2026, 10:42 AM</span></button><button>Label</button><button>Restore</button></article>';
      const fake = {
        elements: { historyPreview: document.getElementById('historyPreview') },
        escapeHtml: UIController.prototype.escapeHtml,
        lineDiff: UIController.prototype.lineDiff
      };
      UIController.prototype.previewHistory.call(fake,
        { title: 'Armor of God', sections: [{ lines: [{ lyrics: 'Stand firm in the armor of God' }, { lyrics: 'Old lyric that was misheard' }] }] },
        { revision: 2, label: 'Before bridge edit', song: { title: 'Armor of God', sections: [{ lines: [{ lyrics: 'Stand firm in the armor of God' }, { lyrics: 'Correct authoritative lyric' }] }] } }
      );
    }""")
    Path("artifacts/e2e").mkdir(parents=True, exist_ok=True)
    page.screenshot(path="artifacts/e2e/history-readable-diff.png")
    print("6/6 UX gap checks passed")
    browser.close()
