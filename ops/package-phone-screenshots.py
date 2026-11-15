"""Package only the seven visually reviewed native Android screenshots."""
from pathlib import Path
import hashlib, json, struct, zipfile

root = Path(__file__).resolve().parents[1]
names = ['01-connexion', '02-espace-eleve', '03-planning-eleve', '04-espace-parent', '05-notifications', '06-espace-enseignant', '07-agenda-enseignant']
folder = root / 'store/google-play/phone'
archive = root / 'release/EduBest-Captures-Google-Play-20261029.zip'
report = []
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name in names:
        file = folder / (name + '.png')
        data = file.read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', data[16:24]) == (1080, 1920)
        assert len(data) < 8 * 1024 * 1024
        bundle.write(file, file.name)
        report.append({'file': file.name, 'width': 1080, 'height': 1920, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    bundle.writestr('LIRE-MOI.txt', 'EduBest - Captures Google Play\n\n7 captures PNG originales de l’application native sur émulateur Android téléphone.\n1080 x 1920 pixels. Données fictives uniquement. Aucun mot de passe inclus.\n\nDécompressez ce ZIP. Dans Google Play Console > Fiche Play Store principale > Téléphone > Captures d’écran, sélectionnez les fichiers PNG puis enregistrez. Ne téléversez pas le ZIP lui-même.\n\nVersion 1.1.2 (3), variante x86_64 pour émulateur, JavaScript identique à l’APK de publication. Les fichiers APK/AAB de publication sont inchangés.\n')
(root / 'verification/google-play-phone-screenshots-20261029.json').write_text(json.dumps({'source': 'native Android emulator, isolated review environment', 'screenshots': report, 'archive': str(archive)}, ensure_ascii=False, indent=2), encoding='utf-8')
print(archive)
print(f'{len(report)} PNG verified; archive {archive.stat().st_size} bytes')
