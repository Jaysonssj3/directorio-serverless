import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';

// Ejecuta el serializador real de la versión instalada de Expo, sin cargar módulos iOS.
function loadSource(file: string, dependencies: Record<string, unknown> = {}): Record<string, any> {
  const source = readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exported = {};
  new Function('require', 'exports', compiled.outputText)((name: string) => {
    if (!(name in dependencies)) throw new Error(`Dependencia no prevista: ${name}`);
    return dependencies[name];
  }, exported);
  return exported;
}
const expo = dirname(require.resolve('expo/package.json'));
const blobs = loadSource(join(expo, 'src/utils/blobUtils.ts'));
const converter = loadSource(join(expo, 'src/winter/fetch/convertFormData.ts'), { '../../utils/blobUtils': blobs });
const patch = loadSource(join(expo, 'src/winter/FormData.ts'));
class NativeFormData { _parts: unknown[] = []; }
patch.installFormDataPatch(NativeFormData);
const createForm = () => new NativeFormData() as unknown as FormData;

test('Expo 57 reproduces failure for the old React Native URI-only upload', async () => {
  const body = createForm();
  body.append('archivo', { uri: 'file:///perfil.jpg', name: 'perfil.jpg', type: 'image/jpeg' } as unknown as Blob);
  await assert.rejects(converter.convertFormDataAsync(body, 'test-boundary'), /Unsupported FormDataPart/);
});
test('Expo multipart reads file bytes and preserves the archivo field', async () => {
  const content = new Uint8Array([255, 216, 255, 217]);
  let reads = 0;
  // Contrato público de File de expo-file-system; el lector nativo se sustituye en Node.
  const file = { uri: 'file:///perfil.jpg', name: 'perfil.jpg', type: 'image/jpeg', bytes: async () => { reads++; return content; } };
  const body = createForm();
  body.append('archivo', file as unknown as Blob);
  const result = await converter.convertFormDataAsync(body, 'test-boundary');
  const encoded = Buffer.from(result.body);
  assert.equal(reads, 1);
  assert.ok(encoded.includes(Buffer.from(content)));
  assert.match(encoded.toString(), /name="archivo"; filename="perfil.jpg"/);
  assert.match(encoded.toString(), /content-type: image\/jpeg/);
  assert.match(encoded.toString(), /--test-boundary--/);
});
