# Self-hosted runtime libraries

These browser assets are served locally so PDF import, chord processing, and PDF export do not depend on a CDN. Packages were acquired from the official npm registry at the exact versions below. Package licenses are retained beside each asset.

| Package | Version | npm source | npm tarball integrity | Runtime asset | SHA-256 | License |
| --- | --- | --- | --- | --- | --- | --- |
| pdfjs-dist | 3.11.174 | `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-3.11.174.tgz` | `sha512-TdTZPf1trZ8/UFu5Cx/GXB7GZM30LT+wWUNfsi6Bq8ePLnb+woNKtDymI2mxZYBpMbonNFqKmiz684DIfnd8dA==` | `pdfjs/3.11.174/pdf.min.js` | `5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946` | Apache-2.0 |
| pdfjs-dist | 3.11.174 | same package | same integrity | `pdfjs/3.11.174/pdf.worker.min.js` | `feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b` | Apache-2.0 |
| tonal | 5.0.0 | `https://registry.npmjs.org/tonal/-/tonal-5.0.0.tgz` | `sha512-I/irUdAUPRJcZXNrSmMcoaWs53FRnhub+HOYFNj2KLOBvp1swysxEwruJEAZ8QlCugeGj5IfXFSK5+rMPBTZ+g==` | `tonal/5.0.0/tonal.min.js` | `324b22e47aad85d92f942cddc91862da6973aa584a3990c9c1127dec22a212dd` | MIT |
| jspdf | 2.5.1 | `https://registry.npmjs.org/jspdf/-/jspdf-2.5.1.tgz` | `sha512-hXObxz7ZqoyhxET78+XR34Xu2qFGrJJ2I2bE5w4SM8eFaFEkW2xcGRVUss360fYelwRSid/jT078kbNvmoW0QA==` | `jspdf/2.5.1/jspdf.umd.min.js` | `98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875` | MIT |

PDF.js CMaps come from the same `pdfjs-dist@3.11.174` package. `pdfjs/3.11.174/cmaps/manifest.json` is the complete offline-cache inventory. The upstream CMap license is retained as `pdfjs/3.11.174/cmaps/LICENSE`.
