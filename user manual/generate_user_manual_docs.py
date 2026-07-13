from pathlib import Path
from fpdf import FPDF
from docx import Document
import re

root = Path(__file__).parent
md_path = root / "PROJECT_MANUAL.md"
docx_path = root / "PROJECT_MANUAL.docx"
pdf_path = root / "PROJECT_MANUAL.pdf"

text = md_path.read_text(encoding="utf-8")
lines = text.splitlines()

# DOCX generation
doc = Document()
for line in lines:
    if line.startswith("# "):
        doc.add_heading(line[2:].strip(), level=1)
    elif line.startswith("## "):
        doc.add_heading(line[3:].strip(), level=2)
    elif line.startswith("### "):
        doc.add_heading(line[4:].strip(), level=3)
    elif line.startswith("#### "):
        doc.add_heading(line[5:].strip(), level=4)
    elif line.startswith("- "):
        doc.add_paragraph(line[2:].strip(), style="List Bullet")
    elif re.match(r"^\|.*\|$", line):
        # simple table row, render plain text
        clean = " | ".join(cell.strip() for cell in line.strip().strip("|").split("|"))
        doc.add_paragraph(clean)
    elif line.strip() == "```":
        # code fences: render block as preformatted text
        doc.add_paragraph(line)
    else:
        doc.add_paragraph(line)

doc.save(docx_path)

# PDF generation
class PDF(FPDF):
    def header(self):
        pass

pdf = PDF(orientation="P", unit="mm", format="A4")
pdf.set_auto_page_break(auto=True, margin=15)
pdf.add_page()
pdf.set_font("Helvetica", size=11)

def safe_text(value):
    return value.encode("latin-1", errors="replace").decode("latin-1")

for line in lines:
    safe_line = safe_text(line)
    if safe_line.startswith("# "):
        pdf.set_font("Helvetica", "B", 18)
        pdf.multi_cell(0, 10, safe_text(safe_line[2:].strip()))
        pdf.ln(2)
        pdf.set_font("Helvetica", size=11)
    elif safe_line.startswith("## "):
        pdf.set_font("Helvetica", "B", 14)
        pdf.multi_cell(0, 8, safe_text(safe_line[3:].strip()))
        pdf.ln(1)
        pdf.set_font("Helvetica", size=11)
    elif safe_line.startswith("### "):
        pdf.set_font("Helvetica", "B", 12)
        pdf.multi_cell(0, 8, safe_text(safe_line[4:].strip()))
        pdf.ln(1)
        pdf.set_font("Helvetica", size=11)
    elif safe_line.startswith("- "):
        pdf.multi_cell(0, 6, safe_text("- " + safe_line[2:].strip()))
    elif safe_line.startswith("```"):
        pdf.set_font("Courier", size=10)
        pdf.multi_cell(0, 5, safe_text(safe_line))
        pdf.set_font("Helvetica", size=11)
    elif safe_line.strip() == "":
        pdf.ln(3)
    else:
        pdf.multi_cell(0, 6, safe_line)

pdf.output(pdf_path)
print(f"Generated: {docx_path} and {pdf_path}")
