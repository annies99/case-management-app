// frontend/services/consentTemplate.js

export function buildConsentHtml({
  patient = {},
  signatureDataUrl = '',
  signedAtISO,
}) {
  const ESCAPE_ATTR = {
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;',
    '<': '&lt;',
    '>': '&gt;',
  };

  const escapeAttr = (value) =>
    String(value ?? '')
      .replace(/[&"'<>]/g, (char) => ESCAPE_ATTR[char] || char);

  const signature = signatureDataUrl
    ? `<img src="${signatureDataUrl}" style="border:1px solid #000;width:100%;height:150px;" />`
    : '<div style="border:1px solid #000;width:100%;height:150px;"></div>';

  const signedAt = signedAtISO ? new Date(signedAtISO) : new Date();
  const dateOnly = Number.isNaN(signedAt.getTime())
    ? ''
    : signedAt.toISOString().slice(0, 10);

  const scriptPayload = JSON.stringify({
    name: patient.name ?? '',
    dob: patient.dob ?? '',
    address: patient.address ?? '',
    phone: patient.phone ?? '',
    email: patient.email ?? '',
    date: dateOnly,
  }).replace(/</g, '\\u003C');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Patient Information Form</title>
<style>
 body{font-family:Arial,sans-serif;margin:16px;line-height:1.5}
 label{display:inline-block;width:140px;font-weight:bold}
 input[type="text"]{width:100%}
 .row{margin:8px 0}.section{margin-top:16px}
 .content-box{border:1px solid #ccc;padding:10px;background:#f9f9f9;white-space:pre-wrap}
 canvas{border:1px solid #000;display:block;margin-top:10px;width:100%;height:150px}
 button{margin-top:10px}
 .actions{position:sticky;bottom:0;background:#fff;padding:8px 0}
</style></head><body>
<h2>Patient Information</h2>
<div class="row"><label>Name:</label><input id="name" type="text" value="${escapeAttr(patient.name)}" readonly="readonly"/></div>
<div class="row"><label>Date of Birth:</label><input id="dob" type="text" value="${escapeAttr(patient.dob)}" readonly="readonly"/></div>
<div class="row"><label>Address:</label><input id="address" type="text" value="${escapeAttr(patient.address)}" readonly="readonly"/></div>
<div class="row"><label>Phone Number:</label><input id="phone" type="text" value="${escapeAttr(patient.phone)}" readonly="readonly"/></div>
<div class="row"><label>Email:</label><input id="email" type="text" value="${escapeAttr(patient.email)}" readonly="readonly"/></div>

<div class="section"><h3>Purpose</h3>
<div class="content-box">Northwestern Medicine Palos Hospital, in collaboration with Labor Force, offers care coordination services to assist patients who have experienced accidental injuries. Our care coordination program assists patients with scheduling follow-up appointments with health care providers such as physicians, therapy providers, and providers of diagnostic tests and procedures. Care coordination also promotes communication among the various providers who may care for you after your injury. The goal of care coordination is to ensure that you receive seamless and high-quality care following your visit to the Northwestern Medicine Palos Hospital Emergency Department.

Our care coordination program also assists patients in coordinating communications with insurance companies and others who may be involved in determining payment for care.

By signing this consent form, you authorize Labor Force to:
1. Contact you after discharge from the Northwestern Medicine Palos Hospital Emergency Department to discuss the follow-up care you may need, and to assist you with scheduling follow-up care.
2. Coordinate appointments with Northwestern Medicine or other health care providers, consistent with your preferences and at a time that meets your needs.
3. Assist with the collection and transmittal of documentation related to your ongoing treatment, such as insurance coverage documents and medical records, to ensure a smooth continuation of care.</div></div>

<div class="section"><h3>Important Notes About Your Rights</h3>
<div class="content-box"><strong>Patient Choice:</strong>
• You have the right to choose your healthcare providers and facilities.
• Participation in this initiative is entirely voluntary. You are under no obligation to use the care coordination services offered.

<strong>No Impact on Emergency Treatment:</strong>
• Your decision to participate in the care coordination program will not affect the emergency medical care you may receive from Northwestern Medicine Palos Hospital.

<strong>Privacy and Confidentiality:</strong>
• Your medical information will be handled in compliance with HIPAA.
• Information will only be shared with providers directly involved in your care, and as required for scheduling or insurance purposes.</div></div>

<div class="section"><h3>Consent for Participation</h3>
<div class="content-box">By signing below, you acknowledge that:
1. You understand the purpose and scope of this care coordination initiative.
2. Labor Force will contact you within 24 hours of your discharge from the Emergency Department at Northwestern Medicine Palos Hospital to discuss and coordinate necessary follow-up care.
3. Labor Force will attempt to schedule your care with Northwestern Medicine providers whenever possible, and will suggest alternate providers if services are not available from Northwestern Medicine at a time that meets your needs.
4. You have the right to choose the providers from whom you will receive care. Labor Force will use its best efforts to schedule care with providers of your choosing.
5. You may withdraw consent at any time by notifying Labor Force at 866-572-1447.</div></div>

<div class="section"><h3>Signature</h3>
${signature}
<div class="row"><label for="sig-date">Date:</label><input id="sig-date" type="text" value="${escapeAttr(dateOnly)}" readonly="readonly"/></div>
<div class="actions">
  <button id="clear">Clear</button>
  <button id="submit">Agree & Submit</button>
</div>

<script>
(function(){
  const doc=document;
  const P=${scriptPayload};
  const set=(id,val)=>{const el=doc.getElementById(id); if(el){el.value=val||''; el.setAttribute('readonly','readonly');}};
  set('name',P.name); set('dob',P.dob); set('address',P.address); set('phone',P.phone); set('email',P.email); set('sig-date',P.date);
})();
</script>
</div></body></html>`;

  return html;
}
