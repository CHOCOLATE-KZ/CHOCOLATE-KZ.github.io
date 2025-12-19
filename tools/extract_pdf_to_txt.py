import pdfplumber
from pathlib import Path

PDFS = [
    "blockchain_part_1.pdf",
    "blockchain_part_2.pdf",
]


OUT = Path("tools/merged.txt")

def extract(pdf_path: str) -> str:
    text_parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            if t.strip():
                text_parts.append(t)
    return "\n".join(text_parts)

def main():
    all_text = []
    for p in PDFS:
        all_text.append(f"\n\n===== SOURCE: {p} =====\n\n")
        all_text.append(extract(p))
    OUT.write_text("\n".join(all_text), encoding="utf-8")
    print("Saved:", OUT.resolve())

if __name__ == "__main__":
    main()
