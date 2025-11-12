const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../db');

const router = express.Router();

router.post("/enviarMailFinal", async (req, res) => {
    const { contratoId, modo } = req.body;
    const empresaId = req.session.user?.empresa_id;

    if (!empresaId || !contratoId) {
        return res.status(400).json({ error: "Faltan datos de empresa o contrato." });
    }

    try {
        // 📄 Ruta absoluta al PDF
        const pdfPath = path.join(
            __dirname,
            "..",
            "..",
            "archivos",
            "empresas",
            String(empresaId),
            "sof_en_uso",
            `sof_contrato_${contratoId}.pdf`
        );

        if (modo === "pdf") {
            if (!fs.existsSync(pdfPath)) {
                return res.status(404).json({ error: "No se encontró el archivo PDF del SOF." });
            }

            // URL pública (ya que app.js sirve /archivos/)
            const pdfURL = `/archivos/empresas/${empresaId}/sof_en_uso/sof_contrato_${contratoId}.pdf`;
            return res.json({ success: true, pdf_url: pdfURL });
        }

        // 🔹 Modo texto
        const result = await pool.query(
            `SELECT fecha, dia, hora, evento, remarks
       FROM actualizaciones_sof
       WHERE contrato_id = $1 AND tipo = $2
       ORDER BY id ASC`,
            [contratoId, 'actividad']
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "No se encontraron actualizaciones del SOF." });
        }

        const lineas = result.rows.map((r) => {
            const fecha = r.fecha ? new Date(r.fecha).toLocaleDateString("es-AR") : "";
            return `${fecha} (${r.dia || ""}) ${r.hora || ""} | ${r.evento || ""} ${r.remarks ? "- " + r.remarks : ""}\n`;
        });

        const cuerpo = [
            "STATEMENT OF FACTS",
            "===============================",
            ...lineas,
            "===============================",
            "\nEnviado automáticamente por SeaChain"
        ].join("\n");

        res.json({
            success: true,
            asunto: `SOF Final - Contrato ${contratoId}`,
            cuerpo,
        });
    } catch (error) {
        console.error("Error en enviarMailFinal:", error);
        res.status(500).json({ error: "Error al generar el contenido del mail." });
    }
});

module.exports = router;
