from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
output=root/'notification-lambda'/'dist'/'notification-lambda.zip'
output.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(output,'w',ZIP_DEFLATED) as z:
    z.write(root/'notification-lambda'/'handler.py','handler.py')
print('Packaged notification-lambda.zip')
