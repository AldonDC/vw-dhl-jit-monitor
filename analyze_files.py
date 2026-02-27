import pandas as pd
from pdfminer.high_level import extract_text
import json
import os
from datetime import datetime

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

files_dir = "Archivos_Reto2"
results = {}

# 1. Analizar Excel (BESI JIS AKSYS)
excel_path = os.path.join(files_dir, "BESI JIS AKSYS CW 09.xlsx")
try:
    df = pd.read_excel(excel_path)
    # Extraer las primeras filas para entender la estructura
    results["inventory_sample"] = df.head(5).to_dict(orient="records")
    results["inventory_columns"] = list(df.columns)
except Exception as e:
    results["excel_error"] = str(e)

# 2. Analizar PDF (Ciclos)
pdf_path = os.path.join(files_dir, "6001008710-ciclos.pdf")
try:
    text = extract_text(pdf_path)
    results["ciclos_text_sample"] = text[:3000]
except Exception as e:
    results["pdf_error"] = str(e)

# 3. Analizar PDF (Correos/Instrucciones)
emails_path = os.path.join(files_dir, "Reto2_correos.pdf")
try:
    text_emails = extract_text(emails_path)
    results["emails_text_sample"] = text_emails[:3000]
except Exception as e:
    results["emails_error"] = str(e)

print(json.dumps(results, indent=2, cls=DateTimeEncoder))
