import nodemailer from "nodemailer";
import { db } from "./db";
import { uid } from "./security";
import { PoolClient } from "pg";
import { encryptSecret, decryptSecret, mfaAvailable } from "./protection";
import { reviewEnabled } from "./review";
type Context = {
  tenant?: string;
  user?: string;
  topic?: string;
  resource?: string;
};
export async function emailJob(
  recipient: string,
  title: string,
  text: string,
  c: PoolClient | typeof db = db,
  context: Context = {},
) {
  const id = uid(),
    content = JSON.stringify({ title, text });
  const payload = mfaAvailable()
    ? JSON.stringify({ encrypted: encryptSecret(content, id) })
    : content;
  await c.query(
    "INSERT INTO outbox(id,channel,recipient,payload,tenant_id,user_id,topic,resource_id) VALUES($1,'email',$2,$3,$4,$5,$6,$7)",
    [
      id,
      recipient,
      payload,
      context.tenant ?? null,
      context.user ?? null,
      context.topic ?? "account",
      context.resource ?? null,
    ],
  );
  return id;
}
export async function notify(
  c: PoolClient,
  tenant: string,
  user: string,
  title: string,
  body: string,
  options: {
    email?: boolean;
    path?: string;
    topic?: string;
    resource?: string;
  } = {},
) {
  const recipient = (
    await c.query(
      "SELECT id,email,verified FROM users WHERE tenant_id=$1 AND id=$2 AND active",
      [tenant, user],
    )
  ).rows[0];
  if (!recipient) return { notifications: 0, emails: 0 };
  await c.query(
    "INSERT INTO notifications(id,tenant_id,user_id,title,body) VALUES($1,$2,$3,$4,$5)",
    [uid(), tenant, user, title, body],
  );
  const path = options.path ?? "notifications";
  await c.query(
    `INSERT INTO outbox(id,channel,recipient,payload,tenant_id,user_id,topic,resource_id) SELECT gen_random_uuid(),'push',token,$2::jsonb,$3,$1,$4,$5 FROM device_tokens WHERE user_id=$1`,
    [
      user,
      JSON.stringify({
        title: "EduBest",
        body: "Une nouvelle information est disponible dans votre espace sécurisé. / معلومة جديدة متاحة في مساحتك الآمنة.",
        data: { view: path },
      }),
      tenant,
      options.topic ?? path,
      options.resource ?? null,
    ],
  );
  let emails = 0;
  if (options.email && recipient.verified) {
    const url = `${process.env.WEB_URL ?? "http://localhost:3100"}/app?view=${encodeURIComponent(path)}`;
    await emailJob(
      recipient.email,
      `EduBest · ${title}`,
      `${body}\n\nConsulter votre espace / فتح مساحتك :\n${url}\n\nCet email vous est adressé par votre établissement EduBest.`,
      c,
      {
        tenant,
        user,
        topic: options.topic ?? path,
        resource: options.resource,
      },
    );
    emails = 1;
  }
  return { notifications: 1, emails };
}
export async function invoiceNotice(
  c: PoolClient,
  tenant: string,
  invoice: string,
) {
  const i = (
    await c.query(
      `SELECT i.id,i.label,i.amount_centimes,i.due_date,i.status,s.parent_id,s.user_id,s.name FROM invoices i JOIN students s ON s.tenant_id=i.tenant_id AND s.id=i.student_id WHERE i.tenant_id=$1 AND i.id=$2`,
      [tenant, invoice],
    )
  ).rows[0];
  if (!i || i.status !== "open") return { notifications: 0, emails: 0 };
  const users = (
    await c.query(
      "SELECT id,role,verified FROM users WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND active",
      [tenant, [i.parent_id, i.user_id].filter(Boolean)],
    )
  ).rows;
  const parent = users.find((u) => u.id === i.parent_id && u.verified);
  const pupil = users.find((u) => u.id === i.user_id && u.verified);
  const mailRecipient = parent?.id ?? pupil?.id;
  let notifications = 0,
    emails = 0;
  const body = `${i.name} — ${i.label}\nMontant / المبلغ : ${(i.amount_centimes / 100).toFixed(2)} DA\nÉchéance / آخر أجل : ${i.due_date}\nVous pouvez consulter et imprimer cette échéance depuis votre espace. / يمكنك عرض المستحق وطباعته من مساحتك.`;
  for (const u of users) {
    const r = await notify(
      c,
      tenant,
      u.id,
      "Nouvelle échéance / مستحق جديد",
      body,
      {
        email: u.id === mailRecipient,
        path: "invoices",
        topic: "invoice",
        resource: invoice,
      },
    );
    notifications += r.notifications;
    emails += r.emails;
  }
  return {
    notifications,
    emails,
    email_recipient: mailRecipient ? "parent_or_student" : "none_verified",
    note: emails
      ? "Email mis en file ; la réception dépend du serveur destinataire."
      : "Aucun email vérifié disponible. Les notifications restent dans les comptes associés.",
  };
}
export function mailFailure(error: unknown) {
  const e = error as {
    code?: string;
    responseCode?: number;
    response?: string;
    brevoStatus?: number;
  };
  if (e.brevoStatus) {
    return {
      code: "BREVO_" + e.brevoStatus,
      reason:
        "Envoi refusé par le relais HTTPS. Consultez le journal transactionnel Brevo.",
      permanent:
        e.brevoStatus >= 400 &&
        e.brevoStatus < 500 &&
        ![408, 425, 429].includes(e.brevoStatus),
    };
  }
  const code = String(e.responseCode ?? e.code ?? "DELIVERY_ERROR")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 40);
  const text = String(e.response ?? "").toLowerCase();
  const reason =
    /spf|dkim|dmarc|5\.7\.|blocked|block list|blocklist|spam|reputation/.test(
      text,
    )
      ? "Refus de politique antispam : vérifier SPF, DKIM, DMARC et réputation IP auprès de l’hébergeur."
      : /auth|535/.test(code + " " + text)
        ? "Authentification SMTP refusée : vérifier la configuration privée."
        : /550|551|553/.test(code)
          ? "Adresse refusée par le serveur destinataire ; vérifier l’adresse et le domaine."
          : "Livraison différée ou refusée ; vérifier le serveur SMTP et les journaux de l’hébergeur.";
  return { code, reason, permanent: Number(e.responseCode) >= 500 };
}

async function sendBrevoEmail(
  key: string,
  from: string,
  recipient: string,
  payload: { title: string; text: string },
) {
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(from);
  const replyTo = process.env.CONTACT_EMAIL;
  const result = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json", "api-key": key },
    body: JSON.stringify({
      sender: match ? { name: match[1], email: match[2] } : { email: from },
      to: [{ email: recipient }],
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      subject: payload.title,
      textContent: payload.text,
    }),
  });
  if (!result.ok)
    throw Object.assign(new Error("Brevo rejected email"), {
      brevoStatus: result.status,
    });
  const { messageId } = (await result.json()) as { messageId?: string };
  return String(messageId ?? "").slice(0, 200);
}

export async function deliver() {
  if (reviewEnabled()) return; // No SMTP or push traffic from the isolated review service.
  const c = await db.connect();
  let job: any;
  try {
    await c.query("BEGIN");
    const r = await c.query(
      "SELECT * FROM outbox WHERE state='pending' AND next_at<=now() AND (channel='push' OR $1::boolean) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      [!!(process.env.BREVO_API_KEY || process.env.SMTP_HOST)],
    );
    if (!r.rowCount) {
      await c.query("COMMIT");
      return;
    }
    job = r.rows[0];
    await c.query(
      "UPDATE outbox SET state='sending',attempts=attempts+1,next_at=now()+interval '5 minutes',updated_at=now() WHERE id=$1",
      [job.id],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  let reference = "";
  try {
    if (job.channel === "email") {
      const payload = job.payload.encrypted
        ? JSON.parse(decryptSecret(job.payload.encrypted, job.id))
        : job.payload;
      const from = process.env.SMTP_FROM ?? "EduBest <contact@localhost>";
      const brevoKey = process.env.BREVO_API_KEY;
      if (brevoKey) {
        reference = await sendBrevoEmail(
          brevoKey,
          from,
          job.recipient,
          payload,
        );
      } else {
        const sender =
          process.env.SMTP_ENVELOPE_FROM ??
          from.match(/<([^>]+)>/)?.[1] ??
          from;
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_PORT === "465",
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 20000,
          tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
          requireTLS: process.env.NODE_ENV === "production",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
        });
        try {
          const info = await transport.sendMail({
            from,
            to: job.recipient,
            envelope: { from: sender, to: [job.recipient] },
            replyTo: process.env.CONTACT_EMAIL || undefined,
            subject: payload.title,
            text: payload.text,
            date: new Date(),
            messageId: `<${job.id}@${sender.split("@")[1] ?? "localhost"}>`,
            headers: {
              "Auto-Submitted": "auto-generated",
              "X-Auto-Response-Suppress": "All",
            },
          });
          if (!info.accepted?.length)
            throw Object.assign(new Error("SMTP rejected"), {
              responseCode: 550,
            });
          reference = String(info.messageId ?? "").slice(0, 200);
        } finally {
          transport.close();
        }
      }
    } else {
      const r = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          to: job.recipient,
          ...job.payload,
          sound: "default",
          channelId: "default",
        }),
        signal: AbortSignal.timeout(10000),
      });
      const data = (await r.json()) as any;
      if (!r.ok || data.data?.status !== "ok") {
        if (data.data?.details?.error === "DeviceNotRegistered")
          await db.query("DELETE FROM device_tokens WHERE token=$1", [
            job.recipient,
          ]);
        throw Object.assign(new Error("Push rejected"), {
          code: data.data?.details?.error ?? "PUSH_REJECTED",
        });
      }
      reference = data.data.id ?? "";
    }
    await db.query(
      "UPDATE outbox SET state='sent',recipient='',payload='{}'::jsonb,error_code='',last_error='',delivery_ref=$2,receipt_checked=(channel='email'),next_at=now()+interval '15 minutes',updated_at=now() WHERE id=$1",
      [job.id, reference],
    );
  } catch (error) {
    const f = mailFailure(error);
    await db.query(
      "UPDATE outbox SET state=CASE WHEN attempts>=5 OR $4 THEN 'failed' ELSE 'pending' END,error_code=$2,last_error=$3,next_at=now()+least(3600,120*power(2,attempts-1))*interval '1 second',updated_at=now() WHERE id=$1",
      [
        job.id,
        f.code,
        f.reason,
        f.permanent || f.code === "DeviceNotRegistered",
      ],
    );
  }
}
export async function checkPushReceipt() {
  if (reviewEnabled()) return;
  const r = await db.query(
    "UPDATE outbox SET next_at=now()+interval '15 minutes' WHERE id=(SELECT id FROM outbox WHERE channel='push' AND state='sent' AND NOT receipt_checked AND delivery_ref<>'' AND next_at<=now() ORDER BY next_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING id,user_id,delivery_ref,created_at",
  );
  const job = r.rows[0];
  if (!job) return;
  const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.EXPO_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ ids: [job.delivery_ref] }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return;
  const receipt = ((await response.json()) as any).data?.[job.delivery_ref];
  if (receipt?.status === "ok")
    await db.query(
      "UPDATE outbox SET receipt_checked=true,updated_at=now() WHERE id=$1",
      [job.id],
    );
  else if (receipt?.status === "error")
    await db.query(
      "UPDATE outbox SET state='failed',receipt_checked=true,error_code=$2,last_error='Le service push a refusé la remise sur le téléphone.',updated_at=now() WHERE id=$1",
      [
        job.id,
        String(receipt.details?.error ?? "PUSH_RECEIPT_ERROR").slice(0, 40),
      ],
    );
  else if (Date.now() - Date.parse(job.created_at) > 86400000)
    await db.query(
      "UPDATE outbox SET receipt_checked=true,error_code='RECEIPT_UNCONFIRMED',last_error='Reçu de remise non disponible après 24 heures.',updated_at=now() WHERE id=$1",
      [job.id],
    );
}
export function startWorker() {
  if (reviewEnabled()) return;
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await db.query(
        "UPDATE outbox SET state='pending',updated_at=now() WHERE state='sending' AND next_at<now()",
      );
      await deliver();
      await checkPushReceipt();
    } catch {
      console.error("Worker: livraison reportée");
    } finally {
      running = false;
    }
  }, 1500);
  timer.unref();
  return timer;
}
