/**
 * ASTOR FABRICATION ENGINE v1.1
 * Propuesta multicapa compatible con la fabricación real de Astor.
 *
 * La propuesta es preliminar y siempre requiere validación profesional.
 */
(function () {
  "use strict";

  const ENGINE = {
    version: "1.1.0",

    evaluate(record) {
      const fields = record?.fields || {};
      const checks = record?.checks || {};
      const text = this.normalize([
        fields.diagnosis,
        fields.mainPainArea,
        fields.medicalIndication,
        fields.evaluationNotes,
        fields.functionalGoal,
        fields.treatmentGoal,
        fields.mainActivity,
        fields.activityLevel,
        fields.footwearType,
        fields.medicalBackground,
      ].filter(Boolean).join(" "));

      const context = {
        text,
        weightKg: Number(fields.weightKg || 0),
        heightCm: Number(fields.heightCm || 0),
        bmi: this.calculateBmi(Number(fields.weightKg || 0), Number(fields.heightCm || 0)),
        age: this.calculateAge(fields.birthDate),
        painScale: Number(fields.painScale || 0),
        painSide: fields.painSide || "",
        diabetes: Boolean(checks.hasDiabetes),
        neuropathy: Boolean(checks.redFlagNeuropathy),
        wound: Boolean(checks.hasWound),
        arthritis: Boolean(checks.hasArthritis),
        previousSurgery: Boolean(checks.previousSurgery),
        pronation: Boolean(checks.postureFootPronation),
        supination: Boolean(checks.postureFootSupination),
        kneeValgus: Boolean(checks.postureKneeValgus),
        kneeVarus: Boolean(checks.postureKneeVarus),
      };

      const proposal = {
        riskLevel: "standard",
        requiresProfessionalReview: true,
        alerts: [],

        layers: {
          base: {
            material: "EVA",
            shoreA: 55,
            thicknessMm: 2,
            notes: "Base completa.",
          },
          structure: {
            material: "Cuero Flex / LEFA",
            thicknessMm: null,
            extension: "Completa",
            notes: "Conformar y estabilizar la geometría final.",
          },
          corrections: [],
          topCover: {
            material: "Cubierta antimicótica y antibacterial",
            thicknessMm: 2,
            additionalMaterials: [],
            notes: "",
          },
        },

        heelCup: "14 mm",
        archProfile: "Medio",
        unloads: [],
        reinforcements: [],
        manufacturingNotes: [],
        rationale: [],
      };

      this.applySafety(context, proposal);
      this.applyAnthropometry(context, proposal);
      this.applyDiagnosis(context, proposal);
      this.applyActivity(context, proposal);
      this.applyPosture(context, proposal);
      this.applyLaterality(context, proposal);

      proposal.layers.corrections = this.unique(proposal.layers.corrections);
      proposal.layers.topCover.additionalMaterials =
        this.unique(proposal.layers.topCover.additionalMaterials);
      proposal.unloads = this.unique(proposal.unloads);
      proposal.reinforcements = this.unique(proposal.reinforcements);
      proposal.alerts = this.unique(proposal.alerts);
      proposal.manufacturingNotes = this.unique(proposal.manufacturingNotes);
      proposal.rationale = this.unique(proposal.rationale);

      return proposal;
    },

    calculateBmi(weightKg, heightCm) {
      if (!weightKg || !heightCm) return null;
      return weightKg / ((heightCm / 100) ** 2);
    },

    calculateAge(birthDate) {
      if (!birthDate) return null;
      const birth = new Date(birthDate);
      if (Number.isNaN(birth.getTime())) return null;
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const month = today.getMonth() - birth.getMonth();
      if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
      return age;
    },

    normalize(value) {
      return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    },

    containsAny(text, terms) {
      return terms.some((term) => text.includes(this.normalize(term)));
    },

    unique(values) {
      return [...new Set(values.filter(Boolean))];
    },

    setBaseShore(proposal, shore) {
      proposal.layers.base.shoreA = shore;
      proposal.layers.base.thicknessMm = 2;
    },

    applySafety(ctx, p) {
      if (ctx.diabetes || ctx.neuropathy || ctx.wound) {
        p.riskLevel = "high";
        p.alerts.push("Caso de riesgo: revisión profesional obligatoria antes de fabricar.");
        p.layers.topCover.material = "Cubierta antimicótica y antibacterial";
        p.layers.topCover.thicknessMm = 3;
        p.layers.topCover.additionalMaterials.push("Poron localizado según zonas de riesgo");
        p.manufacturingNotes.push("Evitar bordes, escalones y concentraciones puntuales de presión.");
      }
      if (ctx.wound) p.alerts.push("Herida o úlcera: no autorizar fabricación remota sin evaluación clínica.");
      if (ctx.painScale >= 8) p.alerts.push("Dolor intenso: verificar signos de alarma.");
      if (ctx.previousSurgery) p.alerts.push("Revisar antecedente quirúrgico e indicación médica.");
    },

    applyAnthropometry(ctx, p) {
      if (ctx.weightKg >= 120 || (ctx.bmi && ctx.bmi >= 40)) {
        this.setBaseShore(p, 65);
        p.layers.structure.extension = "Completa reforzada";
        p.layers.topCover.thicknessMm = 3;
        p.layers.topCover.additionalMaterials.push("Poron localizado si existe hiperpresión");
        p.reinforcements.push("Refuerzo estructural de retropié y mediopié");
        p.rationale.push("Carga corporal muy elevada.");
      } else if (ctx.weightKg >= 95 || (ctx.bmi && ctx.bmi >= 30)) {
        this.setBaseShore(p, 60);
        p.layers.structure.extension = "Completa";
        p.layers.topCover.thicknessMm = 3;
        p.reinforcements.push("Refuerzo de arco y retropié");
        p.rationale.push("Carga mecánica aumentada por peso o IMC.");
      } else if (ctx.weightKg > 0 && ctx.weightKg < 55) {
        this.setBaseShore(p, 45);
        p.layers.topCover.thicknessMm = 1.5;
        p.rationale.push("Carga corporal baja.");
      } else {
        this.setBaseShore(p, 55);
      }

      if (ctx.age !== null && ctx.age >= 65) {
        p.layers.topCover.thicknessMm = Math.max(3, Number(p.layers.topCover.thicknessMm || 0));
        p.layers.topCover.additionalMaterials.push("Poron localizado según tolerancia");
        p.heelCup = "16 mm";
        p.manufacturingNotes.push("Priorizar estabilidad, confort y reducción del riesgo de caídas.");
      }

      if (ctx.age !== null && ctx.age <= 14) {
        this.setBaseShore(p, Math.min(55, p.layers.base.shoreA));
        p.manufacturingNotes.push("Considerar crecimiento y controles periódicos.");
      }
    },

    applyDiagnosis(ctx, p) {
      const t = ctx.text;

      if (this.containsAny(t, ["fascitis", "fasciitis", "dolor de talon", "espolon"])) {
        p.unloads.push("Descarga calcánea");
        p.layers.corrections.push("Soporte longitudinal progresivo");
        p.layers.topCover.additionalMaterials.push("Poron calcáneo");
        p.heelCup = "16 a 18 mm";
        p.rationale.push("Sobrecarga de talón referida.");
      }

      if (this.containsAny(t, ["pie plano", "plano valgo", "pronacion"])) {
        p.archProfile = "Medio a alto, progresivo";
        p.heelCup = "16 a 18 mm";
        p.layers.corrections.push("Control de pronación");
        p.layers.corrections.push("Estabilización medial de retropié");
        p.reinforcements.push("Refuerzo medial");
      }

      if (this.containsAny(t, ["pie cavo", "cavo", "supinacion"])) {
        p.archProfile = "Bajo a medio, de contacto amplio";
        p.layers.topCover.thicknessMm = 3;
        p.layers.topCover.additionalMaterials.push("Poron en zonas de hiperpresión");
        p.unloads.push("Descarga selectiva de zonas de hiperpresión");
        p.layers.corrections.push("Aumento de superficie de contacto");
      }

      if (this.containsAny(t, ["metatarsalgia", "dolor antepie", "dolor de antepie"])) {
        p.unloads.push("Descarga retrocapital");
        p.layers.corrections.push("Barra o botón retrocapital según evaluación");
        p.layers.topCover.additionalMaterials.push("Poron en antepié");
      }

      if (this.containsAny(t, ["hallux valgus", "juanete", "primer radio"])) {
        p.unloads.push("Liberación del primer radio");
        p.layers.corrections.push("Soporte retrocapital");
        p.manufacturingNotes.push("Evitar presión directa sobre la eminencia medial.");
      }

      if (this.containsAny(t, ["sesamoiditis", "sesamoideo"])) {
        p.unloads.push("Descarga sesamoidea");
        p.layers.topCover.additionalMaterials.push("Poron alrededor de la descarga");
      }

      if (this.containsAny(t, ["aquiles", "tendon de aquiles", "tendinopatia aquilea"])) {
        p.layers.corrections.push("Elevación de talón gradual");
        p.manufacturingNotes.push("Validar altura, simetría y tolerancia.");
      }
    },

    applyActivity(ctx, p) {
      const t = ctx.text;

      if (this.containsAny(t, ["rugby", "futbol", "basket", "contacto"])) {
        p.layers.topCover.material = "EVA deportiva o cubierta resistente";
        p.layers.topCover.thicknessMm = 2;
        p.reinforcements.push("Refuerzo de retropié");
        p.reinforcements.push("Estabilización para cambios de dirección");
        p.manufacturingNotes.push("Controlar volumen total dentro del calzado deportivo.");
      }

      if (this.containsAny(t, ["running", "correr", "corredor", "maraton"])) {
        p.layers.topCover.material = "EVA deportiva";
        p.layers.topCover.thicknessMm = 2;
        p.layers.topCover.additionalMaterials.push("Poron localizado según patrón de impacto");
        p.layers.corrections.push("Flexibilidad controlada en antepié");
      }

      if (this.containsAny(t, ["seguridad", "laboral", "trabajo de pie", "botin"])) {
        if (p.layers.base.shoreA < 55) this.setBaseShore(p, 55);
        p.layers.topCover.thicknessMm = 3;
        p.manufacturingNotes.push("Priorizar resistencia y compatibilidad con calzado laboral.");
      }
    },

    applyPosture(ctx, p) {
      if (ctx.pronation || ctx.kneeValgus) {
        p.layers.corrections.push("Control medial progresivo");
        p.reinforcements.push("Estabilización de retropié");
      }
      if (ctx.supination || ctx.kneeVarus) {
        p.layers.corrections.push("Aumento de contacto lateral controlado");
        p.layers.topCover.additionalMaterials.push("Poron lateral según hiperpresión");
      }
      if (ctx.arthritis) {
        p.layers.topCover.thicknessMm = 3;
        p.layers.topCover.additionalMaterials.push("Poron en zonas dolorosas");
      }
    },

    applyLaterality(ctx, p) {
      if (ctx.painSide === "Derecho") {
        p.manufacturingNotes.push("Comparar ambos pies y revisar especialmente el derecho.");
      } else if (ctx.painSide === "Izquierdo") {
        p.manufacturingNotes.push("Comparar ambos pies y revisar especialmente el izquierdo.");
      } else if (ctx.painSide === "Ambos") {
        p.manufacturingNotes.push("Diseñar cada pie por separado; no copiar correcciones automáticamente.");
      }
    },

    formatOrder(record, proposal = this.evaluate(record)) {
      const f = record?.fields || {};
      const bmi = this.calculateBmi(Number(f.weightKg || 0), Number(f.heightCm || 0));

      return [
        "ASTOR REMOTE CLINIC",
        "ORDEN PRELIMINAR DE FABRICACIÓN",
        "",
        `Caso: ${record?.code || "Sin código"}`,
        `Paciente: ${f.fullName || "Sin nombre"}`,
        `Peso: ${f.weightKg || "—"} kg`,
        `Estatura: ${f.heightCm || "—"} cm`,
        `IMC: ${bmi ? bmi.toFixed(1) : "—"}`,
        "",
        "CAPA 1 · BASE",
        `Material: ${proposal.layers.base.material}`,
        `Densidad: ${proposal.layers.base.shoreA} Shore A`,
        `Espesor: ${proposal.layers.base.thicknessMm} mm`,
        "",
        "CAPA 2 · ESTRUCTURA",
        `Material: ${proposal.layers.structure.material}`,
        `Extensión: ${proposal.layers.structure.extension}`,
        `Observación: ${proposal.layers.structure.notes}`,
        "",
        "CAPA 3 · CORRECCIONES",
        proposal.layers.corrections.length
          ? proposal.layers.corrections.map((x) => `- ${x}`).join("\n")
          : "- Sin propuesta automática",
        "",
        "DESCARGAS",
        proposal.unloads.length
          ? proposal.unloads.map((x) => `- ${x}`).join("\n")
          : "- Sin propuesta automática",
        "",
        "CAPA 4 · TOP COVER",
        `Material: ${proposal.layers.topCover.material}`,
        `Espesor: ${proposal.layers.topCover.thicknessMm || "Según diseño"} mm`,
        proposal.layers.topCover.additionalMaterials.length
          ? `Complementos:\n${proposal.layers.topCover.additionalMaterials.map((x) => `- ${x}`).join("\n")}`
          : "Complementos: ninguno",
        "",
        "REFUERZOS",
        proposal.reinforcements.length
          ? proposal.reinforcements.map((x) => `- ${x}`).join("\n")
          : "- Sin propuesta automática",
        "",
        "OBSERVACIONES",
        proposal.manufacturingNotes.length
          ? proposal.manufacturingNotes.map((x) => `- ${x}`).join("\n")
          : "- Sin observaciones",
        "",
        "ALERTAS",
        proposal.alerts.length
          ? proposal.alerts.map((x) => `- ${x}`).join("\n")
          : "- Sin alertas detectadas",
        "",
        "ESTADO",
        "Propuesta automática pendiente de validación profesional.",
      ].join("\n");
    },
  };

  window.ASTOR_FABRICATION_ENGINE = ENGINE;
})();
