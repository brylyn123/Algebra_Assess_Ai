from pathlib import Path
lines=Path('src/NewAssessment.js').read_text().splitlines()
for i in range(190,206):
    if i < len(lines):
        print(i+1, lines[i])
