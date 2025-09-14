"""
CLI interface for SoloTranscribeCLI
"""

import click
import logging
from pathlib import Path
from typing import List

from .config import config
from .models import OutputFormats, ProcessingOptions
from .core.processor import TranscriptionProcessor
from .core.manifest import ManifestManager


@click.group()
@click.version_option()
def cli():
    """SoloTranscribeCLI - Local video transcription tool"""
    config.setup_logging()


@cli.command()
@click.option('--in', 'input_file', required=True, type=click.Path(exists=True, path_type=Path),
              help='Input file with video URLs (txt or csv)')
@click.option('--out', 'output_dir', required=True, type=click.Path(path_type=Path),
              help='Output directory for transcripts')
@click.option('--format', 'formats', default='txt,json',
              help='Output formats (comma-separated): txt,json,srt,vtt')
@click.option('--summarize/--no-summarize', default=None,
              help='Enable/disable transcript summarization')
@click.option('--delete-temp/--keep-temp', default=None,
              help='Delete temporary files after processing')
@click.option('--cap-budget', type=float, default=None,
              help='Budget cap in USD')
@click.option('--dry-run', is_flag=True, default=False,
              help='Show cost/time estimates without processing')
def run(input_file: Path, output_dir: Path, formats: str, summarize: bool,
        delete_temp: bool, cap_budget: float, dry_run: bool):
    """Process video URLs and generate transcripts"""

    try:
        # Parse formats
        format_list = []
        for fmt in formats.split(','):
            fmt = fmt.strip().lower()
            try:
                format_list.append(OutputFormats(fmt))
            except ValueError:
                raise click.BadParameter(f"Invalid format: {fmt}. Supported: txt,json,srt,vtt")

        # Create processing options
        options = ProcessingOptions(
            input_file=input_file,
            output_dir=output_dir,
            formats=format_list,
            enable_summary=summarize if summarize is not None else config.enable_summary,
            delete_temp=delete_temp if delete_temp is not None else config.delete_temp_on_success,
            dry_run=dry_run,
            budget_cap=cap_budget if cap_budget is not None else config.cap_budget_usd
        )

        # Create processor
        processor = TranscriptionProcessor()

        if dry_run:
            click.echo("🔍 Running dry-run analysis...")
            estimates = processor.estimate_batch(options)

            click.echo(f"\n📊 Batch Analysis:")
            click.echo(f"   URLs to process: {estimates['total_urls']}")
            click.echo(f"   Estimated duration: {estimates['estimated_duration']:.1f} minutes")
            click.echo(f"   Estimated cost: ${estimates['estimated_cost']:.2f}")

            if estimates['estimated_cost'] > options.budget_cap:
                click.echo(f"⚠️  Estimated cost (${estimates['estimated_cost']:.2f}) exceeds budget cap (${options.budget_cap:.2f})")
                return

            click.echo("\n✅ Ready to process!")
        else:
            click.echo("🚀 Starting transcription batch...")
            manifest = processor.process_batch(options)

            click.echo(f"\n📄 Results saved to: {manifest.output_dir}")
            click.echo(f"   Completed: {manifest.completed_jobs}/{manifest.total_jobs}")
            click.echo(f"   Failed: {manifest.failed_jobs}")
            click.echo(f"   Total cost: ${manifest.total_actual_cost:.2f}")

            if manifest.failed_jobs > 0:
                click.echo(f"\n⚠️  {manifest.failed_jobs} jobs failed. Run 'solotranscribe retry' to retry failed jobs.")

    except Exception as e:
        logging.error(f"Failed to process batch: {e}")
        click.echo(f"❌ Error: {e}", err=True)
        raise click.Abort()


@cli.command()
@click.option('--manifest', required=True, type=click.Path(exists=True, path_type=Path),
              help='Path to manifest.json file')
@click.option('--cap-budget', type=float, default=None,
              help='Budget cap for retry attempts')
def retry(manifest: Path, cap_budget: float):
    """Retry failed jobs from a previous run"""

    try:
        # Load manifest
        manager = ManifestManager()
        manifest_data = manager.load_manifest(manifest)

        # Check for retryable jobs
        retryable_jobs = manifest_data.get_retryable_jobs()

        if not retryable_jobs:
            click.echo("✅ No failed jobs to retry")
            return

        click.echo(f"🔄 Found {len(retryable_jobs)} jobs to retry")

        # Estimate retry costs
        processor = TranscriptionProcessor()
        retry_estimates = processor.estimate_retry(retryable_jobs)

        budget = cap_budget if cap_budget is not None else config.cap_budget_usd
        if retry_estimates['estimated_cost'] > budget:
            click.echo(f"⚠️  Retry cost (${retry_estimates['estimated_cost']:.2f}) exceeds budget (${budget:.2f})")
            if not click.confirm("Continue anyway?"):
                return

        # Retry failed jobs
        updated_manifest = processor.retry_failed_jobs(manifest_data, budget)

        click.echo(f"\n📄 Retry completed!")
        click.echo(f"   Newly completed: {updated_manifest.completed_jobs - manifest_data.completed_jobs}")
        click.echo(f"   Still failed: {updated_manifest.failed_jobs}")

    except Exception as e:
        logging.error(f"Failed to retry jobs: {e}")
        click.echo(f"❌ Error: {e}", err=True)
        raise click.Abort()


@cli.command()
@click.option('--in', 'input_file', required=True, type=click.Path(exists=True, path_type=Path),
              help='Input file with video URLs')
def dryrun(input_file: Path):
    """Show cost and time estimates without processing"""

    try:
        options = ProcessingOptions(
            input_file=input_file,
            output_dir=Path('./temp_estimate'),
            formats=[OutputFormats.TXT],
            dry_run=True
        )

        processor = TranscriptionProcessor()
        estimates = processor.estimate_batch(options)

        click.echo(f"📊 Batch Estimate for: {input_file}")
        click.echo(f"   Total URLs: {estimates['total_urls']}")
        click.echo(f"   Estimated duration: {estimates['estimated_duration']:.1f} minutes")
        click.echo(f"   Estimated cost: ${estimates['estimated_cost']:.2f}")
        click.echo(f"   Budget cap: ${config.cap_budget_usd:.2f}")

        if estimates['estimated_cost'] > config.cap_budget_usd:
            click.echo("⚠️  Estimated cost exceeds budget cap!")
        else:
            click.echo("✅ Within budget!")

    except Exception as e:
        logging.error(f"Failed to estimate batch: {e}")
        click.echo(f"❌ Error: {e}", err=True)
        raise click.Abort()


@cli.command()
def status():
    """Show configuration and API status"""

    click.echo("🔧 SoloTranscribeCLI Configuration:")
    click.echo(f"   Output directory: {config.out_dir}")
    click.echo(f"   Temp directory: {config.temp_dir}")
    click.echo(f"   Budget cap: ${config.cap_budget_usd:.2f}")
    click.echo(f"   Retry limit: {config.retry_limit}")

    # Check API keys
    click.echo("\n🔑 API Keys:")
    click.echo(f"   FreeConvert: {'✅ Set' if config.freeconvert_api_key else '❌ Missing'}")
    click.echo(f"   AssemblyAI: {'✅ Set' if config.assemblyai_api_key else '❌ Missing'}")

    # TODO: Add API connectivity tests
    click.echo("\n🌐 API Status:")
    click.echo("   FreeConvert: Not tested")
    click.echo("   AssemblyAI: Not tested")


if __name__ == '__main__':
    cli()