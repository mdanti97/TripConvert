const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const output = document.getElementById('output');
const uploadedImage = document.getElementById('uploadedImage');
const imageUpload = document.getElementById('imageUpload');

navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => video.srcObject = stream)
  .catch(err => console.error("Errore webcam:", err));

function performOCRFromCanvas() {
  const sourceLang = document.getElementById('sourceLang').value;
  const targetLang = document.getElementById('targetLang').value;
  const sourceCurrency = document.getElementById('sourceCurrency').value;
  const targetCurrency = document.getElementById('targetCurrency').value;

  output.innerText = "Analisi in corso...";

  Tesseract.recognize(canvas, sourceLang, {
    logger: m => console.log(m)
  }).then(({ data: { text } }) => {
    output.innerText = "Testo rilevato:\n" + text;

    translateText(text, sourceLang, targetLang).then(translated => {
      output.innerText += `\n\n📘 Traduzione:\n${translated}`;
      const amounts = findCurrencyValues(text, sourceCurrency);
      if (amounts.length) {
        output.innerText += `\n\n💱 Valute trovate:\n${amounts.join(", ")}`;
        convertCurrencies(amounts, sourceCurrency, targetCurrency).then(convertedList => {
          output.innerText += `\n\n💰 Convertito in ${targetCurrency}:\n${convertedList.join(", ")}`;
        });
      }
    });
  });
}

function capture() {
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  performOCRFromCanvas();
}

imageUpload.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    uploadedImage.src = e.target.result;
    uploadedImage.onload = function() {
      const context = canvas.getContext('2d');
      canvas.width = uploadedImage.width;
      canvas.height = uploadedImage.height;
      context.drawImage(uploadedImage, 0, 0);
      performOCRFromCanvas();
    };
    uploadedImage.style.display = "block";
  };
  reader.readAsDataURL(file);
});

async function translateText(text, from, to) {
  const res = await fetch('https://libretranslate.com/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: from,
      target: to,
      format: "text"
    })
  });
  const data = await res.json();
  return data.translatedText;
}

function findCurrencyValues(text, currencyCode) {
  const regex = new RegExp(`(?:\\b|\s)(\d+(?:[\\.,]\d{1,2})?)\s?${currencyCode}\\b|\\${currencySymbol(currencyCode)}(\d+(?:[\\.,]\d{1,2})?)`, 'gi');
  const matches = [...text.matchAll(regex)];
  return matches.map(m => m[1] || m[2]);
}

function currencySymbol(code) {
  return {
    USD: '$',
    EUR: '€',
    GBP: '£'
  }[code] || '';
}

async function convertCurrencies(amounts, from, to) {
  const results = [];
  for (let amt of amounts) {
    let cleanAmt = parseFloat(amt.replace(",", "."));
    const res = await fetch(`https://api.exchangerate.host/convert?from=${from}&to=${to}&amount=${cleanAmt}`);
    const data = await res.json();
    results.push(`${cleanAmt} ${from} → ${data.result.toFixed(2)} ${to}`);
  }
  return results;
}
