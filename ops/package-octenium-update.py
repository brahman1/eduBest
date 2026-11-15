"""Build a Linux update archive locally. Never connects to the hosting or database."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from datetime import datetime
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[1]


def archive(runtime, target, prefix, account):
    entries = {}
    if isinstance(runtime, dict):
        entries.update(runtime)
    else:
        entries.update(read_runtime(runtime))
    for rel in entries:
        file = Path(rel)
        if ".." in file.parts or not rel.startswith("runtime/"):
            raise RuntimeError("Chemin de paquet invalide")
        if (file.name.startswith(".env") and not file.name.endswith(".example")) or file.name in ("api.env", "backup.key", "credentials.json", "google-services.json") or file.suffix.lower() in (".key", ".pem", ".p12", ".p8", ".pfx", ".jks", ".keystore", ".db", ".dump", ".edubest-backup"):
            raise RuntimeError(f"Fichier prive refuse : {rel}")
    return write_archive(entries, target, prefix, account)


def read_runtime(runtime):
    entries = {}
    for section in ("api", "web"):
        folder = runtime / section
        if not folder.is_dir():
            raise RuntimeError(f"Compilation absente : runtime/{section}")
        for file in folder.rglob("*"):
            if file.is_symlink():
                raise RuntimeError(f"Lien non portable : {file}")
            if not file.is_file():
                continue
            rel = file.relative_to(runtime).as_posix()
            # New installations have a separate procedure. Never ship an empty DB here.
            if file.name in ("schema-empty.sql", "DEPLOIEMENT.md"):
                continue
            if (file.name.startswith(".env") and not file.name.endswith(".example")) or file.name in ("api.env", "backup.key", "credentials.json", "google-services.json"):
                raise RuntimeError(f"Fichier prive refuse : {rel}")
            if file.suffix.lower() in (".key", ".pem", ".p12", ".p8", ".pfx", ".jks", ".keystore", ".db", ".dump", ".edubest-backup"):
                raise RuntimeError(f"Fichier prive refuse : {rel}")
            entries["runtime/" + rel] = (file.read_bytes(), file.stat().st_mode & 0o777)
    return entries


def write_archive(entries, target, prefix, account):
    for required in ("runtime/api/api/dist/main.js", "runtime/api/ops/octenium/api-entry.cjs", "runtime/web/entry.cjs", "runtime/web/web/server.js"):
        if required not in entries:
            raise RuntimeError(f"Compilation incomplete : {required}")
    if not any(n.startswith("runtime/web/web/.next/static/") for n in entries):
        raise RuntimeError("Fichiers statiques .next absents")
    base = f"/home/{account}/{prefix}"
    entries["reference/api-app.js"] = ((f'"use strict";\nprocess.env.EDUBEST_ENV_FILE = "/home/{account}/edubest-private/api.env";\nrequire("{base}/runtime/api/ops/octenium/api-entry.cjs");\n').encode(), 0o644)
    entries["reference/web-app.js"] = ((f'"use strict";\nrequire("{base}/runtime/web/entry.cjs");\n').encode(), 0o644)
    note = f"""# Mise a jour EduBest — {prefix}

Paquet compile Linux : API + site. Aucun deploiement automatique.
Extraire dans /home/{account} : le dossier {prefix} sera cree.
Les fichiers reference/api-app.js et reference/web-app.js sont des modeles.
Relever les vrais demarreurs actifs dans cPanel et les sauvegarder avant modification.
Conserver les racines et noms de demarreurs actuels ; adapter uniquement leur contenu
pour utiliser les nouveaux runtimes. Ne pas remplacer les fichiers au hasard.
Conserver /home/{account}/edubest-private/api.env et SECURITY_ENCRYPTION_KEY existants.
Ne pas lancer octenium:prepare, setup-school ou importer un schema vide.
Sauvegarder PostgreSQL avec ses donnees avant la bascule et verifier la restauration.
L'API applique les migrations manquantes existantes au demarrage.
Verifier les deux applications, redemarrer selon le guide et vider le cache NGINX.
Tester connexion, roles, planning et tableaux de bord ; conserver les anciens runtimes.
Les APK/IPA et les comptes mobiles ne sont pas inclus.

Le fichier MANIFEST.json confirme seulement la compilation et l'integrite du ZIP.
Il ne certifie pas une recette utilisateur ni une validation de production.
"""
    entries["LIRE-MISE-A-JOUR.md"] = (note.encode(), 0o644)
    source_paths = ["package.json", "package-lock.json", "ops/Dockerfile.octenium", ".dockerignore"]
    source_paths += [p.relative_to(ROOT).as_posix() for base in ("api/src", "api/migrations", "shared/src", "web/app", "web/lib") for p in (ROOT / base).rglob("*") if p.is_file()]
    manifest = {"product": "EduBest", "release": prefix, "generated_at": datetime.now().astimezone().isoformat(), "linux_build": True, "deployment_performed": False, "database_or_credentials_included": False, "source_sha256": {n: hashlib.sha256((ROOT / n).read_bytes()).hexdigest() for n in sorted(source_paths)}, "sha256": {n: hashlib.sha256(v[0]).hexdigest() for n, v in sorted(entries.items())}}
    entries["MANIFEST.json"] = ((json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode(), 0o644)
    target.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(target, "x", ZIP_DEFLATED, compresslevel=9) as z:
        for name, (data, mode) in sorted(entries.items()):
            info = ZipInfo(prefix + "/" + name)
            info.create_system = 3
            info.external_attr = ((0o100000 | mode) << 16)
            info.compress_type = ZIP_DEFLATED
            z.writestr(info, data)
    with ZipFile(target) as z:
        if z.testzip() is not None:
            raise RuntimeError("ZIP invalide")
        for name, digest in manifest["sha256"].items():
            if hashlib.sha256(z.read(prefix + "/" + name)).hexdigest() != digest:
                raise RuntimeError("Controle d'integrite refuse")
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_suffix(".zip.sha256.txt").write_text(digest + "  " + target.name + "\n", encoding="utf-8")
    return target


def main():
    parser = argparse.ArgumentParser(description="Compiler et empaqueter une mise a jour Linux EduBest pour Octenium, sans deploiement.")
    parser.add_argument("--version", default=datetime.now().strftime("%Y%m%d-%H%M%S"), help="Nom unique, par exemple 20261027-r1")
    parser.add_argument("--account", default="ggcsckht", help="Nom du compte cPanel (pas le mot de passe)")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,45}", args.version) or not re.fullmatch(r"[a-z][a-z0-9_]{0,31}", args.account):
        raise RuntimeError("Nom de version ou compte cPanel invalide")
    docker = shutil.which("docker")
    if not docker:
        raise RuntimeError("Docker Desktop est absent. Installer Docker Desktop puis ouvrir le moteur Linux.")
    status = subprocess.run([docker, "info", "--format", "{{.OSType}}"], capture_output=True, text=True)
    if status.returncode or status.stdout.strip() != "linux":
        raise RuntimeError("Ouvrir Docker Desktop et attendre Engine running avec les conteneurs Linux, puis relancer cette commande.")
    prefix = "edubest-release-" + args.version
    stage = ROOT / ".local" / ("octenium-package-" + args.version)
    target = ROOT / "release" / ("EduBest-Octenium-MAJ-" + args.version + ".zip")
    if target.exists():
        raise RuntimeError("Cette version existe deja. Choisir un nouveau --version, sans ecraser l'ancien paquet.")
    print("Compilation Linux du site et de l'API. Aucun acces a Octenium ni a PostgreSQL.", flush=True)
    # Stream the Linux export in memory instead of duplicating node_modules on disk.
    process = subprocess.Popen([docker, "build", "--target", "export", "--build-arg", "EDUBEST_PUBLIC_SITE_ONLY=false", "-f", "ops/Dockerfile.octenium", "--output", "type=tar,dest=-", "."], cwd=ROOT, stdout=subprocess.PIPE)
    entries = {}
    links = {}
    try:
        with tarfile.open(fileobj=process.stdout, mode="r|") as tar:
            for member in tar:
                name = member.name.removeprefix("./")
                if not name.startswith(("runtime/api/", "runtime/web/")):
                    continue
                if member.issym():
                    raise RuntimeError("Lien non portable : " + name)
                if member.islnk():
                    link = member.linkname.removeprefix("./")
                    if not link.startswith(("runtime/api/", "runtime/web/")) or ".." in Path(link).parts:
                        raise RuntimeError("Lien de paquet invalide : " + name)
                    links[name] = (link, member.mode & 0o777)
                    continue
                if not member.isfile() or Path(name).name in ("schema-empty.sql", "DEPLOIEMENT.md"):
                    continue
                entries[name] = (tar.extractfile(member).read(), member.mode & 0o777)
        if process.wait():
            raise RuntimeError("Compilation Docker interrompue")
        while links:
            resolved = [name for name, (link, mode) in links.items() if link in entries]
            if not resolved:
                raise RuntimeError("Lien Linux non resolu dans le paquet")
            for name in resolved:
                link, mode = links.pop(name)
                entries[name] = (entries[link][0], mode)
    finally:
        if process.poll() is None:
            process.terminate()
        process.stdout.close()
    result = archive(entries, target, prefix, args.account)
    print("\nZIP verifie cree :\n" + str(result))
    print("Ce ZIP contient le site et l'API ; aucune mise en ligne n'a ete effectuee.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as e:
        print("Preparation interrompue : " + str(e), file=sys.stderr)
        sys.exit(1)
