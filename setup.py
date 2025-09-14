"""
Setup script for SoloTranscribeCLI
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read README
readme_path = Path(__file__).parent / "README.md"
long_description = readme_path.read_text() if readme_path.exists() else ""

# Read requirements
requirements_path = Path(__file__).parent / "requirements.txt"
with open(requirements_path) as f:
    requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]

setup(
    name="solotranscribe-cli",
    version="0.1.0",
    description="Local command line tool for batch video transcription",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="SoloTranscribe",
    author_email="",
    url="",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    include_package_data=True,
    install_requires=requirements,
    python_requires=">=3.8",
    entry_points={
        'console_scripts': [
            'solotranscribe=solotranscribe.cli:cli',
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)