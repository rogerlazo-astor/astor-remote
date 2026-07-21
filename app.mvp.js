/**
 * ASTOR Remote Clinic MVP extensions
 * Compatible con el app.js original.
 * Añade IMC, fotografías posturales y revisión final.
 */
(function () {
  "use strict";

  const postureFiles = [
    ["postureFrontInput", "postureFrontPreview", "postureFront"],
    ["postureBackInput", "postureBackPreview", "postureBack"],
    ["postureRightInput", "postureRightPreview", "postureRight"],
    ["postureLeftInput", "postureLeftPreview", "postureLeft"],
  ];

  function getInput(name) {
    return document.querySelector(`[name="${name}"]`);
  }

  function setRecordField(name, value) {
    const record = typeof activeRecord === "function" ? activeRecord() : null;
    if (!record) return;
    record.fields = record.fields || {};
    record.fields[name] = value ?? "";
  }

  function calculateBmi() {
    const weightInput = document.querySelector("#weightKg");
    const heightInput = document.querySelector("#heightCm");
    const bmiInput = document.querySelector("#bmiValue");
    const classInput = document.querySelector("#bmiClassification");

    if (!weightInput || !heightInput || !bmiInput || !classInput) return;

    const weight = Number(weightInput.value);
    const heightCm = Number(heightInput.value);

    if (!weight || !heightCm || weight <= 0 || heightCm <= 0) {
      bmiInput.value = "";
      classInput.value = "";
      setRecordField("bmiValue", "");
      setRecordField("bmiClassification", "");
      return;
    }

    const heightM = heightCm / 100;
    const bmi = weight / (heightM * heightM);
    const rounded = bmi.toFixed(1);

    let classification = "";
    if (bmi < 18.5) classification = "Bajo peso";
    else if (bmi < 25) classification = "Rango saludable";
    else if (bmi < 30) classification = "Sobrepeso";
    else if (bmi < 35) classification = "Obesidad grado I";
    else if (bmi < 40) classification = "Obesidad grado II";
    else classification = "Obesidad grado III";

    bmiInput.value = rounded;
    classInput.value = classification;
    setRecordField("bmiValue", rounded);
    setRecordField("bmiClassification", classification);

    if (typeof scheduleSave === "function") scheduleSave();
    refreshFinalReview();
  }

  function renderPosturePreview(container, fileRecord) {
    if (!container) return;

    if (container.dataset.url) {
      URL.revokeObjectURL(container.dataset.url);
      delete container.dataset.url;
    }

    if (!fileRecord) {
      container.textContent = "Sin archivo";
      return;
    }

    if (fileRecord.type?.startsWith("image/") && fileRecord.blob) {
      const url = URL.createObjectURL(fileRecord.blob);
      container.dataset.url = url;
      const image = document.createElement("img");
      image.alt = fileRecord.name || "Fotografía postural";
      image.src = url;
      container.replaceChildren(image);
      return;
    }

    container.textContent = fileRecord.name || "Archivo cargado";
  }

  function bindPostureFiles() {
    postureFiles.forEach(([inputId, previewId, key]) => {
      const input = document.querySelector(`#${inputId}`);
      const preview = document.querySelector(`#${previewId}`);
      if (!input || !preview) return;

      input.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (typeof handleFile === "function") {
          await handleFile(key, file);
        }

        const record = typeof activeRecord === "function" ? activeRecord() : null;
        renderPosturePreview(preview, record?.files?.[key]);
        refreshFinalReview();
      });
    });
  }

  function renderAllPosturePreviews() {
    const record = typeof activeRecord === "function" ? activeRecord() : null;

    postureFiles.forEach(([, previewId, key]) => {
      renderPosturePreview(
        document.querySelector(`#${previewId}`),
        record?.files?.[key]
      );
    });
  }

  function consentComplete(record) {
    if (!record) return false;

    const required = [
      "consentRemoteEvaluation",
      "consentHealthData",
      "consentPhotosVideos",
      "consentCommunication",
      "consentTerms",
    ];

    return required.every((key) => Boolean(record.checks?.[key]));
  }

  function countMedia(record) {
    if (!record) return 0;

    const footKeys =
      typeof footViews !== "undefined" ? footViews.map(([key]) => key) : [];

    const additionalKeys = [
      "prescription",
      "gaitVideo",
      "postureFront",
      "postureBack",
      "postureRight",
      "postureLeft",
    ];

    return [...footKeys, ...additionalKeys].filter(
      (key) => Boolean(record.files?.[key])
    ).length;
  }

  function refreshFinalReview() {
    const record = typeof activeRecord === "function" ? activeRecord() : null;

    const patientEl = document.querySelector("#reviewPatient");
    const consentEl = document.querySelector("#reviewConsent");
    const mediaEl = document.querySelector("#reviewMedia");
    const paymentEl = document.querySelector("#reviewPayment");

    if (patientEl) {
      patientEl.textContent = record?.fields?.fullName ? "OK" : "Pendiente";
    }

    if (consentEl) {
      consentEl.textContent = consentComplete(record) ? "OK" : "Pendiente";
    }

    if (mediaEl) {
      mediaEl.textContent = record ? String(countMedia(record)) : "0";
    }

    if (paymentEl) {
      paymentEl.textContent =
        record?.fields?.paymentStatus === "Validado"
          ? "Validado"
          : "Pendiente";
    }
  }

  function validateFinalCase() {
    const record = typeof activeRecord === "function" ? activeRecord() : null;

    if (!record) {
      alert("Primero crea o selecciona un caso.");
      return;
    }

    const missing = [];
    const footPhotoCount =
      typeof footViews !== "undefined"
        ? footViews.filter(([key]) => record.files?.[key]).length
        : 0;

    if (!record.fields?.fullName) missing.push("Nombre del paciente");
    if (!record.fields?.phone) missing.push("Teléfono o WhatsApp");
    if (!record.fields?.city) missing.push("Ciudad");
    if (!consentComplete(record)) missing.push("Consentimiento obligatorio");
    if (!record.files?.prescription) missing.push("Receta médica");
    if (footPhotoCount < 6) missing.push("Al menos 6 fotografías de los pies");
    if (!record.files?.gaitVideo) missing.push("Video de marcha");
    if (!record.fields?.leftLengthCm && !record.fields?.rightLengthCm) {
      missing.push("Medidas de al menos un pie");
    }
    if (!record.checks?.finalConfirmation) {
      missing.push("Confirmación final");
    }

    if (missing.length) {
      alert(`Faltan los siguientes elementos:\n\n- ${missing.join("\n- ")}`);

      if (typeof addHistoryEvent === "function") {
        addHistoryEvent("Revisión final con faltantes", missing.join(", "));
      }
      return;
    }

    record.fields.orderStatus =
      record.fields.paymentStatus === "Validado"
        ? "En revisión"
        : "Pago pendiente";

    if (typeof addHistoryEvent === "function") {
      addHistoryEvent(
        "Caso enviado a revisión profesional",
        "La captura mínima requerida fue completada."
      );
    }

    if (typeof persistActive === "function") persistActive();

    refreshFinalReview();
    alert(`Caso ${record.code} listo para revisión profesional.`);
  }

  function setDefaultConsentDate() {
    const input = getInput("consentDate");
    if (!input || input.value) return;

    const today = new Date().toISOString().slice(0, 10);
    input.value = today;
    setRecordField("consentDate", today);
  }

  function bindReviewEvents() {
    document
      .querySelector("#validateFinalBtn")
      ?.addEventListener("click", validateFinalCase);

    document
      .querySelectorAll('input[name], select[name], textarea[name]')
      .forEach((element) => {
        const eventName =
          element.type === "checkbox" || element.tagName === "SELECT"
            ? "change"
            : "input";

        element.addEventListener(eventName, refreshFinalReview);
      });
  }

  function refreshEnhancements() {
    calculateBmi();
    renderAllPosturePreviews();
    refreshFinalReview();
    setDefaultConsentDate();
  }

  function observePatientChange() {
    const title = document.querySelector("#activePatientTitle");
    if (!title || typeof MutationObserver === "undefined") return;

    new MutationObserver(() => {
      window.setTimeout(refreshEnhancements, 50);
    }).observe(title, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function initMvpExtensions() {
    document
      .querySelector("#weightKg")
      ?.addEventListener("input", calculateBmi);

    document
      .querySelector("#heightCm")
      ?.addEventListener("input", calculateBmi);

    bindPostureFiles();
    bindReviewEvents();
    observePatientChange();
    window.setTimeout(refreshEnhancements, 250);
  }

  initMvpExtensions();
})();
