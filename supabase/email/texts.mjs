// The words of the sign-in email, in every language of the site. "{label}" is the name of the choice on the
// sign-in screen and "Sign in" on the button; both are taken from the site's own language files, so the email
// always says what the screen says. After changing anything here run: node scripts/email.mjs
export const EMAIL_TEXTS = {
  en: {
    title: 'Sign in to PixelPulse',
    preview: 'Your sign-in link and code for PixelPulse.',
    lead: 'Tap the button on the device where you want to create.',
    hint: 'Did the button open in the wrong place? Choose "{label}" on the sign-in screen and type this:',
    foot: "The link and the code work once and stop working after a short time. If you didn't ask to sign in, ignore this email. Nobody gets into your account without it.",
  },
  es: {
    title: 'Inicia sesión en PixelPulse',
    preview: 'Tu enlace y tu código de acceso a PixelPulse.',
    lead: 'Toca el botón en el dispositivo donde quieres crear.',
    hint: '¿El botón se abrió en otro lugar? Elige «{label}» en la pantalla de inicio de sesión y escribe esto:',
    foot: 'El enlace y el código funcionan una sola vez y caducan al poco tiempo. Si no pediste iniciar sesión, ignora este correo. Nadie entra en tu cuenta sin él.',
  },
  pt: {
    title: 'Entre no PixelPulse',
    preview: 'Seu link e código de acesso ao PixelPulse.',
    lead: 'Toque no botão no dispositivo em que você quer criar.',
    hint: 'O botão abriu no lugar errado? Escolha "{label}" na tela de login e digite isto:',
    foot: 'O link e o código funcionam uma única vez e expiram em pouco tempo. Se você não pediu para entrar, ignore este e-mail. Ninguém entra na sua conta sem ele.',
  },
  fr: {
    title: 'Connexion à PixelPulse',
    preview: 'Votre lien et votre code de connexion à PixelPulse.',
    lead: "Touchez le bouton sur l'appareil où vous voulez créer.",
    hint: "Le bouton s'est ouvert au mauvais endroit ? Choisissez « {label} » sur l'écran de connexion et saisissez ceci :",
    foot: "Le lien et le code ne fonctionnent qu'une fois et expirent rapidement. Si vous n'avez pas demandé à vous connecter, ignorez cet e-mail. Personne n'accède à votre compte sans lui.",
  },
  de: {
    title: 'Bei PixelPulse anmelden',
    preview: 'Dein Anmeldelink und Code für PixelPulse.',
    lead: 'Tippe auf den Button auf dem Gerät, auf dem du erstellen möchtest.',
    hint: 'Hat sich der Button an der falschen Stelle geöffnet? Wähle auf dem Anmeldebildschirm „{label}“ und gib das hier ein:',
    foot: 'Link und Code funktionieren nur einmal und laufen nach kurzer Zeit ab. Wenn du keine Anmeldung angefordert hast, ignoriere diese E-Mail. Ohne sie kommt niemand in dein Konto.',
  },
  it: {
    title: 'Accedi a PixelPulse',
    preview: 'Il tuo link e il codice di accesso a PixelPulse.',
    lead: 'Tocca il pulsante sul dispositivo su cui vuoi creare.',
    hint: 'Il pulsante si è aperto nel posto sbagliato? Scegli «{label}» nella schermata di accesso e scrivi questo:',
    foot: 'Il link e il codice funzionano una sola volta e scadono dopo poco. Se non hai chiesto di accedere, ignora questa email. Senza di essa nessuno entra nel tuo account.',
  },
  ja: {
    title: 'PixelPulseにログイン',
    preview: 'PixelPulseのログインリンクとコードです。',
    lead: '作成したいデバイスでボタンをタップしてください。',
    hint: 'ボタンが別の場所で開きましたか？ログイン画面で「{label}」を選び、次のコードを入力してください。',
    foot: 'リンクとコードは1回だけ使え、短時間で無効になります。ログインをリクエストしていない場合は、このメールを無視してください。このメールがなければ、誰もあなたのアカウントに入れません。',
  },
  ko: {
    title: 'PixelPulse에 로그인',
    preview: 'PixelPulse 로그인 링크와 코드입니다.',
    lead: '작업하려는 기기에서 버튼을 누르세요.',
    hint: '버튼이 다른 곳에서 열렸나요? 로그인 화면에서 "{label}"을(를) 선택하고 아래 코드를 입력하세요.',
    foot: '링크와 코드는 한 번만 사용할 수 있고 곧 만료돼요. 로그인을 요청하지 않았다면 이 이메일을 무시하세요. 이 이메일 없이는 누구도 계정에 들어올 수 없어요.',
  },
  zh: {
    title: '登录 PixelPulse',
    preview: '你的 PixelPulse 登录链接和验证码。',
    lead: '请在你想用来创作的设备上点击按钮。',
    hint: '按钮在别处打开了？请在登录页面选择“{label}”，然后输入：',
    foot: '链接和验证码只能使用一次，并会在短时间后失效。如果你没有请求登录，请忽略这封邮件。没有它，任何人都无法进入你的账户。',
  },
  id: {
    title: 'Masuk ke PixelPulse',
    preview: 'Tautan dan kode masukmu untuk PixelPulse.',
    lead: 'Ketuk tombol di perangkat tempat kamu ingin berkreasi.',
    hint: 'Tombolnya terbuka di tempat yang salah? Pilih "{label}" di layar masuk, lalu ketik ini:',
    foot: 'Tautan dan kode hanya bisa dipakai sekali dan segera kedaluwarsa. Jika kamu tidak meminta untuk masuk, abaikan email ini. Tanpa email ini, tidak ada yang bisa masuk ke akunmu.',
  },
};
