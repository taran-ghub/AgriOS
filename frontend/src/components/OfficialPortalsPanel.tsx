type Props = {
  language: 'en' | 'hi'
}

const checkedOn = '2026-10-16'

const portals = [
  {
    id: 'mfmb',
    url: 'https://fasal.haryana.gov.in/',
    domain: 'fasal.haryana.gov.in',
    en: {
      name: 'Meri Fasal Mera Byora',
      description:
        'Haryana’s official portal for farmer and crop registration information.',
    },
    hi: {
      name: 'मेरी फसल, मेरा ब्यौरा',
      description:
        'किसान और फसल पंजीकरण की जानकारी के लिए हरियाणा का आधिकारिक पोर्टल।',
    },
  },
  {
    id: 'pmkisan',
    url: 'https://pmkisan.gov.in/',
    domain: 'pmkisan.gov.in',
    en: {
      name: 'PM-KISAN',
      description:
        'Official PM-KISAN scheme information and farmer services.',
    },
    hi: {
      name: 'पीएम-किसान',
      description:
        'पीएम-किसान योजना की आधिकारिक जानकारी और किसान सेवाएं।',
    },
  },
  {
    id: 'pmfby',
    url: 'https://www.pmfby.gov.in/',
    domain: 'pmfby.gov.in',
    en: {
      name: 'Pradhan Mantri Fasal Bima Yojana',
      description:
        'Official PMFBY crop insurance information and services.',
    },
    hi: {
      name: 'प्रधानमंत्री फसल बीमा योजना',
      description:
        'पीएमएफबीवाई फसल बीमा की आधिकारिक जानकारी और सेवाएं।',
    },
  },
]

const copy = {
  en: {
    title: 'Official farmer portals',
    intro: 'Government information and services for farmers.',
    notice:
      'Check current eligibility, required documents and deadlines on the official website. These links do not confirm that registration is open or that you qualify.',
    open: 'Open official website',
    checked: 'Official link checked',
    privacy:
      'Complete applications on the official website. AgriOS does not collect portal passwords, Aadhaar details or application documents.',
    old:
      'These links have not been reviewed in the last 30 days. Confirm current information on the official websites.',
  },
  hi: {
    title: 'किसानों के आधिकारिक पोर्टल',
    intro: 'किसानों के लिए सरकारी जानकारी और सेवाएं।',
    notice:
      'पात्रता, आवश्यक दस्तावेज़ और अंतिम तारीख आधिकारिक वेबसाइट पर जांचें। ये लिंक पंजीकरण खुला होने या आपकी पात्रता की पुष्टि नहीं करते।',
    open: 'आधिकारिक वेबसाइट खोलें',
    checked: 'आधिकारिक लिंक की जांच',
    privacy:
      'आवेदन आधिकारिक वेबसाइट पर करें। AgriOS पोर्टल के पासवर्ड, आधार विवरण या आवेदन दस्तावेज़ नहीं लेता।',
    old:
      'इन लिंक की पिछले 30 दिनों में समीक्षा नहीं हुई है। नई जानकारी आधिकारिक वेबसाइटों पर जांचें।',
  },
}

export default function OfficialPortalsPanel({ language }: Props) {
  const t = copy[language]

  const checkedDate = new Intl.DateTimeFormat(
    language === 'hi' ? 'hi-IN' : 'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    },
  ).format(new Date(`${checkedOn}T00:00:00Z`))

  const needsReview =
    Date.now() - new Date(`${checkedOn}T00:00:00Z`).getTime()
    > 30 * 24 * 60 * 60 * 1000

  return (
    <section className="form-card" style={{ marginTop: 20 }}>
      <h2>{t.title}</h2>
      <p>{t.intro}</p>

      <aside className="sample-notice">
        <p>{t.notice}</p>
      </aside>

      {needsReview && (
        <p className="error-message" role="status">{t.old}</p>
      )}

      <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
        {portals.map((portal) => (
          <article
            key={portal.id}
            style={{
              padding: 20,
              border: '1px solid #dce5dc',
              borderRadius: 14,
            }}
          >
            <h3>{portal[language].name}</h3>
            <p>{portal[language].description}</p>
            <p><small>{t.checked}: {checkedDate}</small></p>

            <a
              href={portal.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '12px 16px',
                borderRadius: 10,
                background: '#245b38',
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              {t.open} ↗
            </a>

            <small style={{ display: 'block', marginTop: 10 }}>
              {portal.domain}
            </small>
          </article>
        ))}
      </div>

      <p style={{ marginTop: 20 }}>{t.privacy}</p>
    </section>
  )
}