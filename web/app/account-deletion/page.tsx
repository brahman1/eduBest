import Link from "next/link";
import SchoolBrand from "../school-brand";
import { publicNotice } from "../../lib/public-notice";
export default async function AccountDeletion() {
  const p = await publicNotice();
  const email = p?.privacy_email;
  return (
    <main className="legal">
      <SchoolBrand />
      <h1>EduBest — supprimer un compte et ses données</h1>
      <p>
        Vous pouvez demander la suppression de votre compte même si vous n’avez
        plus l’application.
      </p>
      <h2>Depuis votre espace</h2>
      <p>
        Dans l’application, ouvrez « Mon compte », puis la suppression du
        compte. Dans « Sécurité & confidentialité », vous pouvez aussi
        transmettre une demande d’effacement à la direction. Une confirmation de
        votre identité peut être demandée.
      </p>
      <h2>Sans accès à votre compte</h2>
      {email ? (
        <p>
          Écrivez à{" "}
          <a
            href={`mailto:${email}?subject=${encodeURIComponent("EduBest — demande de suppression de compte")}`}
          >
            {email}
          </a>{" "}
          avec le nom de l’école et l’adresse du compte concerné. N’envoyez ni
          mot de passe ni code de double authentification.
        </p>
      ) : (
        <p role="status">
          Les coordonnées de confidentialité de votre école ne sont pas encore
          disponibles. Contactez son secrétariat ; aucune demande n’est
          enregistrée depuis cette page.
        </p>
      )}
      <h2>Ce qui est supprimé ou conservé</h2>
      <p>
        La suppression du compte désactive son accès, révoque ses sessions et
        retire ses jetons de notification et ses liens de connexion. Les liens
        au compte parent/élève sont retirés. Les dossiers scolaires,
        justificatifs financiers, historiques et éléments soumis à conservation
        ne sont pas automatiquement effacés ; la direction examine séparément
        votre demande selon les données et les obligations applicables.
      </p>
      <p>
        {p?.retention ||
          "La politique de conservation doit être précisée par l’établissement avant l’ouverture réelle."}
      </p>
      <p>
        Le compte propriétaire nécessite un transfert de responsabilité
        préalable. Une demande reçue par email est traitée par l’établissement ;
        cette page n’effectue aucune suppression automatique.
      </p>
      <Link href="/legal">Lire la notice de confidentialité</Link>
      <section dir="rtl" lang="ar">
        <h1>إديوبيست — حذف الحساب والبيانات</h1>
        <p>
          يمكنك طلب حذف حسابك حتى دون تثبيت التطبيق. من التطبيق، افتح « حسابي »
          ثم حذف الحساب، أو أرسل طلب محو إلى الإدارة من « الأمان والخصوصية ».
        </p>
        <p>
          {email ? (
            <>
              دون الدخول إلى حسابك، راسل <a href={`mailto:${email}`}>{email}</a>{" "}
              مع اسم المدرسة والبريد المرتبط بالحساب.
            </>
          ) : (
            "تواصل مع أمانة المدرسة عند عدم توفر عنوان الخصوصية."
          )}{" "}
          لا ترسل كلمة المرور أو رموز المصادقة.
        </p>
        <p>
          يُلغى الوصول والجلسات ورموز الإشعار وروابط الحساب. لا تُحذف الملفات
          الدراسية والمالية والسجلات المطلوب الاحتفاظ بها تلقائياً؛ تراجع
          الإدارة طلبك وتحدد ما يمكن محوه وفق الالتزامات المعمول بها. يجب نقل
          مسؤولية المؤسسة قبل حذف حساب المالك. هذه الصفحة لا تنفذ حذفاً آلياً.
        </p>
      </section>
    </main>
  );
}
