def main():
    # 🔧 Archivo base
    archivo_base = "js/empresa-panel.js"

    try:
        with open(archivo_base, "r", encoding="utf-8") as f:
            base_lines = f.readlines()
    except FileNotFoundError:
        print(f"❌ No se encontró el archivo base: {archivo_base}")
        return

    print("📌 Diccionario de reemplazos (base para pegar en tu script):\n")
    print("reemplazos = {")
    for num, line in enumerate(base_lines, start=1):
        if line.strip().startswith("*"):
            linea_limpia = line.strip().lstrip("*").strip()
            print(f"    {num}: '{linea_limpia}',")
    print("}")
    

if __name__ == "__main__":
    main()

