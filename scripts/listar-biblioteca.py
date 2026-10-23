# Lista (somente leitura) as pastas do Drive da Biblioteca antiga: quantidade, tamanho, tipos e amostra de nomes.
import json, urllib.request, urllib.parse, collections, sys
K = 'AIzaSyAx_g0vpxZsYpUX7mOYjEX2Uj3l3jHHkmU'; REF = 'https://www.portaldoeducador.com.br/'
PASTAS = {'livros': '1yxyIz94iDBeo09Ksm3AhDCsWkFCYQQIu', 'audiolivros': '1lcHqRadyhD_xohNe9N7OMs7icIJc3xw9',
          'aprender-brincando': '1X2uCQ-mh_Xq6pL7DdY5PywmzX8MD0onZ', 'gibiteca': '1Dt-c3na1gPHqemoi1yoY01mF8oT1zejZ'}
def listar(pasta, caminho=''):
    tok, out = '', []
    while True:
        p = {'key': K, 'q': "'%s' in parents and trashed=false" % pasta, 'fields': 'nextPageToken,files(id,name,mimeType,size)', 'pageSize': 1000}
        if tok: p['pageToken'] = tok
        d = json.load(urllib.request.urlopen(urllib.request.Request('https://www.googleapis.com/drive/v3/files?' + urllib.parse.urlencode(p), headers={'Referer': REF})))
        for f in d.get('files', []):
            if f['mimeType'] == 'application/vnd.google-apps.folder': out += listar(f['id'], caminho + f['name'] + '/')
            else: f['pasta'] = caminho; out.append(f)
        tok = d.get('nextPageToken')
        if not tok: return out
tudo = {}
for nome, pid in PASTAS.items():
    fs = listar(pid); tudo[nome] = fs
    print('\n==', nome, len(fs), 'arquivos', round(sum(int(f.get('size', 0)) for f in fs) / 1e6), 'MB', dict(collections.Counter(f['mimeType'].split('/')[-1] for f in fs)))
    print('   subpastas:', dict(collections.Counter(f['pasta'] for f in fs).most_common(12)))
    for f in sorted(fs, key=lambda f: f['name'])[:: max(1, len(fs) // 12)][:12]: print('   -', f['pasta'] + f['name'][:70])
json.dump(tudo, open('biblioteca-lista.json', 'w'))
