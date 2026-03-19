from pathlib import Path
lines=Path('src/NewAssessment.js').read_text().splitlines()
for i in range(134, 142):
    if i < len(lines):
        print(i+1, repr(lines[i]))
