from pathlib import Path
lines=Path('src/NewAssessment.js').read_text().splitlines()
print(395, lines[394])
