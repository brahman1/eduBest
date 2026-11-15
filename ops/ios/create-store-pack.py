"""Create truthful App Store metadata and copy the existing approved iOS icon."""
from pathlib import Path
import json, shutil, struct

root = Path(__file__).resolve().parents[2]
out = root/'store/app-store'
out.mkdir(parents=True,exist_ok=True)
locales = {
 'fr-FR': {
  'name':'EduBest', 'subtitle':'Votre école, au quotidien',
  'promotional_text':'Planning, présences, documents et annonces : retrouvez les informations de votre école dans votre espace élève, parent ou enseignant.',
  'keywords':'école,scolaire,élève,parent,enseignant,planning,présences,Algérie,cours,éducation',
  'description':'''EduBest accompagne les élèves, les parents et les équipes de l’école EduBest à M’Chedallah, en Algérie.

Chaque utilisateur retrouve les informations correspondant à son rôle et aux accès attribués par la direction.

POUR LES ÉLÈVES
Consultez votre planning personnel, vos cours, vos présences, les annonces et les documents partagés par l’école.

POUR LES PARENTS
Retrouvez le suivi de vos enfants, leurs cours, leurs présences, les informations financières mises à disposition et les communications de l’établissement.

POUR LES ENSEIGNANTS
Consultez votre agenda et vos groupes, retrouvez les séances et renseignez les présences selon vos autorisations.

POUR LA DIRECTION
Accédez aux outils de gestion de l’établissement : élèves et familles, équipe, groupes, planning, échéances, règlements, documents et annonces.

L’interface est disponible en français et en arabe. Les horaires des cours suivent l’heure d’Alger et les montants sont exprimés en dinars algériens.

Les élèves et les parents peuvent déposer une demande d’inscription, choisir leurs cours et indiquer leur niveau scolaire. Une confirmation par email et la validation de l’école sont nécessaires pour activer le compte. Une connexion Internet est nécessaire.

L’application permet de consulter les frais et les règlements enregistrés par l’établissement ; elle ne propose pas de paiement bancaire intégré.

Contact : contact@edubest.dz
Confidentialité : https://edubest.dz/legal''',
  'whats_new':'Première version iOS d’EduBest : espaces adaptés aux élèves, parents, enseignants et à la direction ; planning, présences, documents et suivi de l’établissement.'
 },
 'ar-SA': {
  'name':'EduBest', 'subtitle':'مدرستك معك كل يوم',
  'promotional_text':'تابع جدول الدروس والحضور والوثائق وإعلانات المدرسة من حساب التلميذ أو الولي أو الأستاذ، بواجهة عربية وفرنسية.',
  'keywords':'مدرسة,تعليم,دروس,حضور,أولياء,الجزائر',
  'description':'''يرافق EduBest تلاميذ مدرسة EduBest وأولياءهم وفريقها في مشدالة بالجزائر.

يعرض كل حساب المعلومات المناسبة لدوره وللصلاحيات التي تمنحها إدارة المدرسة.

للتلاميذ
الاطلاع على جدول الدروس الشخصي والمجموعات والحضور والإعلانات والوثائق التي تشاركها المدرسة.

للأولياء
متابعة الأبناء وجداول دروسهم وحضورهم والمعلومات المالية المتاحة ورسائل المؤسسة.

للأساتذة
الاطلاع على جدول الحصص والمجموعات وتسجيل الحضور حسب الصلاحيات.

للإدارة
أدوات لتسيير التلاميذ والأولياء والفريق والمجموعات والحصص والمستحقات والتسديدات والوثائق والإعلانات.

الواجهة متاحة بالعربية والفرنسية. تُعرض مواعيد الدروس بتوقيت الجزائر والمبالغ بالدينار الجزائري.

يمكن للتلاميذ والأولياء تقديم طلب تسجيل واختيار الدروس وتحديد المستوى الدراسي. يتطلب تفعيل الحساب تأكيد البريد الإلكتروني وموافقة المدرسة. الاتصال بالإنترنت ضروري.

يتيح التطبيق الاطلاع على المستحقات والتسديدات التي تسجلها المؤسسة، ولا يتضمن دفعاً بنكياً داخل التطبيق.

للتواصل: contact@edubest.dz
الخصوصية: https://edubest.dz/legal''',
  'whats_new':'الإصدار الأول من EduBest على iOS: فضاءات للتلاميذ والأولياء والأساتذة والإدارة، مع جدول الحصص والحضور والوثائق ومتابعة المدرسة.'
 }
}
limits = {'name':30,'subtitle':30,'promotional_text':170,'keywords':100,'description':4000,'whats_new':4000}
for locale, fields in locales.items():
    folder = out/'metadata'/locale
    folder.mkdir(parents=True,exist_ok=True)
    for key,text in fields.items():
        assert len(text) <= limits[key], (locale,key,len(text))
        (folder/(key+'.txt')).write_text(text+'\n',encoding='utf-8')
    (folder/'fields.json').write_text(json.dumps(fields,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
common = {
 'app_name':'EduBest','version':'1.1.4','initial_ios_build':'1','bundle_identifier':'dz.edubest.app',
 'sku_suggestion':'EDUBEST-IOS-001','primary_category':'Education','primary_locale':'fr-FR','additional_locale':'ar-SA',
 'availability_to_select':['Algeria'],'download_price':'Free','in_app_purchases':False,'ads':False,'advertising_tracking':False,
 'website':'https://edubest.dz','support_url':'https://edubest.dz','privacy_url':'https://edubest.dz/legal',
 'account_deletion_url':'https://edubest.dz/account-deletion','school_contact':'contact@edubest.dz','technical_contact':'contact@brainfor.net',
 'school_responsible_person':'KACI Belkacem','copyright_proposal':'2026 KACI Belkacem — EduBest',
 'review_contact_phone_to_confirm':True,'seller_name_from_apple_account':'Verify in App Store Connect, not determined by the app name',
 'age_rating':'Complete the Apple questionnaire truthfully; do not copy the Google rating or promise a result.',
 'kids_category':'Not selected automatically; direct use by children must be disclosed truthfully.',
 'publication_status':'Prepared only; no signed IPA, native screenshots or Apple review submission produced yet.'
}
(out/'informations-communes.json').write_text(json.dumps(common,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(out/'informations-communes.txt').write_text('\n'.join(f'{k}: {v}' for k,v in common.items())+'\n',encoding='utf-8')
(out/'icons').mkdir(exist_ok=True)
shutil.copyfile(root/'mobile/assets/ios-icon.png',out/'icons/EduBest-App-Store-1024.png')
data=(out/'icons/EduBest-App-Store-1024.png').read_bytes()
assert struct.unpack('>II',data[16:24]) == (1024,1024)
assert data[25] == 2, 'RGB icon without alpha required'
for family in ['iphone','ipad']:
    (out/'screenshots'/family).mkdir(parents=True,exist_ok=True)
    (out/'screenshots'/family/'A-LIRE.txt').write_text('Aucune capture native '+family+' encore produite. Utiliser le script Mac. Ne pas soumettre les captures Android ni les étirer.\n',encoding='utf-8')
report={'metadata_lengths':{loc:{k:len(v) for k,v in fields.items()} for loc,fields in locales.items()},'icon':{'size':[1024,1024],'mode':'RGB','existing_brand_asset':True},'native_screenshots_generated':False,'signed_ipa_generated':False}
(root/'verification/ios-20261113/store-pack.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(out)
print(json.dumps(report,ensure_ascii=False,indent=2))
