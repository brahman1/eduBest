"""Render EduBest's existing typographic identity for the Play feature banner."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
out = root / 'store/play-feature-1024x500.png'
image = Image.new('RGB', (1024, 500), '#193A4E')
draw = ImageDraw.Draw(image)
regular = 'C:/Windows/Fonts/segoeui.ttf'
bold = 'C:/Windows/Fonts/segoeuib.ttf'
def font(size, weight=False):
    return ImageFont.truetype(bold if weight else regular, size)
# A restrained geometric grid echoes the existing EduBest wordmark.
for x in range(650, 1080, 70):
    draw.line((x, 0, x, 500), fill='#244B61', width=1)
for y in range(10, 510, 70):
    draw.line((650, y, 1024, y), fill='#244B61', width=1)
draw.rounded_rectangle((710, 118, 930, 338), radius=38, fill='#244B61', outline='#315D76', width=2)
draw.text((753, 162), 'EB.', font=font(74, True), fill='#ADC6D8')
draw.text((65, 61), 'VOTRE ÉCOLE, CONNECTÉE', font=font(18, True), fill='#ADC6D8')
draw.text((60, 111), 'Edu', font=font(86, True), fill='white')
x = 60 + draw.textlength('Edu', font=font(86, True))
draw.text((x, 111), 'Best.', font=font(86), fill='#ADC6D8')
draw.text((65, 252), 'Le quotidien de votre école,', font=font(32), fill='white')
draw.text((65, 299), 'au même endroit.', font=font(32), fill='white')
draw.line((65, 391, 116, 391), fill='#6D9EBB', width=4)
draw.text((65, 413), 'Élèves · Parents · Enseignants', font=font(21), fill='#ADC6D8')
image.save(out, optimize=True)
print(out)
