def main():
    # 🔧 Archivo base
    archivo_base = "js/empresa-panel.js"

    # 🔄 Reemplazos definidos en el código (en orden)
    reemplazos = {
16: 'title: i18next.t("companyPanel.invite_accepted_title"),',
17: 'text: i18next.t("companyPanel.invite_accepted_text"),',
18: 'confirmButtonText: i18next.t("common.continue"),',

28: 'alert(i18next.t("companyPanel.session_not_found"));',
36: 'alert(i18next.t("companyPanel.no_company_associated"));',

100: 'console.error(`❌ ${i18next.t("companyPanel.load_error")}:`, error);',
101: 'alert(i18next.t("companyPanel.load_failed"));',

171: 'if (!res.ok) throw new Error(i18next.t("companyPanel.logo_error"));',
176: 'console.error(`❌ ${i18next.t("companyPanel.logo_fetch_failed")}:`, err);',

207: 'resultadosDiv.innerHTML = `<p>${i18next.t("companyPanel.no_users_found")}</p>`;',
220: '? `<span class="texto-invitado">${i18next.t("companyPanel.guest")}</span>`',
221: ': `<button class="btn-invitar-usuario" data-id="${usuario.id}">${i18next.t("companyPanel.invite")}</button>`}',

227: 'console.error(i18next.t("companyPanel.search_users_error"), error);',
228: 'resultadosDiv.innerHTML = `<p>${i18next.t("companyPanel.search_failed")}</p>`;',

247: 'console.error(`❌ ${i18next.t("companyPanel.server_response")}:`, data);',
260: 'console.error(`❌ ${i18next.t("companyPanel.invite_user_error")}:`, e);',

285: '<button id="btn-copiar-link" data-link="${data.link}">📋 ${i18next.t("companyPanel.copy_link")}</button>',
292: 'Swal.fire(i18next.t("common.copied"), i18next.t("common.clipboard_success"), "success");',

300: 'title: i18next.t("common.are_you_sure"),',
301: 'text: i18next.t("companyPanel.leave_confirm_text"),',
304: 'confirmButtonText: i18next.t("companyPanel.leave_yes"),',
305: 'cancelButtonText: i18next.t("common.cancel"),',

322: 'title: i18next.t("companyPanel.left_company_title"),',
334: 'text: data.error || i18next.t("companyPanel.action_failed"),',
342: 'title: i18next.t("companyPanel.unexpected_error_title"),',
343: 'text: i18next.t("companyPanel.unexpected_error_text"),',

350: 'title: i18next.t("companyPanel.delete_company_title"),',
352: '<p>${i18next.t("companyPanel.delete_irreversible")}</p>',
353: '<p>${i18next.t("companyPanel.delete_warning")}</p>',
358: 'confirmButtonText: i18next.t("common.delete"),',
359: 'cancelButtonText: i18next.t("common.cancel"),',

364: 'Swal.showValidationMessage(i18next.t("companyPanel.password_required"));',

380: 'Swal.fire(i18next.t("companyPanel.deleted_title"), data.mensaje, "success").then(() => {',
384: 'Swal.fire("Error", data.error || i18next.t("companyPanel.delete_failed"), "error");',
387: 'Swal.fire("Error", i18next.t("common.connection_error_text"), "error");'

    }


    # 1️⃣ Leer base
    try:
        with open(archivo_base, "r", encoding="utf-8") as f:
            base_lines = f.readlines()
    except FileNotFoundError:
        print(f"❌ No se encontró el archivo base: {archivo_base}")
        return

    # 2️⃣ Reemplazar por número de línea
    resultado = []
    for i, line in enumerate(base_lines, start=1):
        if i in reemplazos:
            indent = line[:len(line) - len(line.lstrip())]
            resultado.append(indent + reemplazos[i] + "\n")
        else:
            resultado.append(line)

    # 3️⃣ Sobrescribir el archivo original
    with open(archivo_base, "w", encoding="utf-8") as f:
        f.writelines(resultado)

    print(f"✅ Proceso terminado. El archivo {archivo_base} fue actualizado.")


if __name__ == "__main__":
    main()

