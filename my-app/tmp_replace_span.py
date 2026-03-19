from pathlib import Path
path=Path('src/NewAssessment.js')
text=path.read_text()
old="<span>{questionType === 'multiple_choice' × 'Multiple choice' : 'Equation / Symbol'}</span>"
new="<span>{questionType === 'multiple_choice' ? 'Multiple choice' : 'Equation / Symbol'}</span>"
if old not in text:
    raise SystemExit('span text missing')
text=text.replace(old,new,1)
path.write_text(text)
