"""Build tables and a standalone SVG from real k6 summaries; never invent missing data."""
import csv
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def row(summary, manifest):
    metrics = summary['data']['metrics']
    def value(name, key):
        return metrics.get(name,{}).get('values',{}).get(key)
    duration = summary['data'].get('state',{}).get('testRunDurationMs',0)/1000
    requests = value('notification_requests','count')
    accepted = value('notification_accepted','count')
    error_rate = value('notification_errors','rate')
    return {'run':manifest.get('start_utc'), 'vus':manifest['vus'], 'stress':manifest['stress'],
        'recipient':manifest.get('body',{}).get('email',summary.get('config',{}).get('email','Sin datos')),
        'planned_s':manifest['planned_seconds'], 'elapsed_s':duration or manifest.get('elapsed_seconds'),
        'exit_code':manifest.get('exit_code'), 'requests':requests,'accepted':accepted,
        'rps':requests/duration if requests is not None and duration else None,
        'accepted_rps':accepted/duration if accepted is not None and duration else None,
        'avg_ms':value('notification_latency','avg'), 'min_ms':value('notification_latency','min'),
        'max_ms':value('notification_latency','max'), 'p95_ms':value('notification_latency','p(95)'),
        'p99_ms':value('notification_latency','p(99)'), 'accepted_avg_ms':value('accepted_latency','avg'),
        'error_pct':100*error_rate if error_rate is not None else None,
        'http429':value('notification_429','count')}

def chart(rows):
    content = ['<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="760" viewBox="0 0 1000 760">',
               '<rect width="1000" height="760" fill="white"/>',
               '<text x="35" y="30" font-size="22">Pruebas k6: resultados observados por ejecución</text>']
    for panel,(key,label) in enumerate([('rps','Throughput (solicitudes/s)'),('avg_ms','Latencia media (ms)'),
                                         ('p95_ms','P95 (ms)'),('error_pct','Errores (%)')]):
        x,y = 70+(panel%2)*490, 90+(panel//2)*340
        valid = [(i,r[key]) for i,r in enumerate(rows) if r.get(key) is not None]
        content += [f'<text x="{x}" y="{y-20}" font-size="17">{label}</text>',
                    f'<path d="M{x},{y} V{y+240} H{x+390}" fill="none" stroke="#666"/>']
        top = max((v for _,v in valid),default=1) or 1
        for i,v in valid:
            px=x+20+i*350/max(1,len(rows)-1); py=y+230-v/top*210
            content += [f'<circle cx="{px:.1f}" cy="{py:.1f}" r="5" fill="#126c61"/>',
                        f'<text x="{px:.1f}" y="{py-10:.1f}" text-anchor="middle" font-size="12">{v:.2f}</text>']
        for i,r in enumerate(rows):
            px=x+20+i*350/max(1,len(rows)-1)
            content.append(f'<text x="{px:.1f}" y="{y+260}" text-anchor="middle" font-size="11">{r["vus"]}</text>')
        content.append(f'<text x="{x+130}" y="{y+283}" font-size="12">Usuarios virtuales (orden de ejecución)</text>')
    return '\n'.join(content+['</svg>'])

def main():
    rows=[]
    for path in sorted((ROOT/'results').glob('*/summary.json')):
        manifest_path=path.with_name('run.json')
        if manifest_path.exists():
            rows.append(row(json.loads(path.read_text(encoding='utf-8')),json.loads(manifest_path.read_text(encoding='utf-8'))))
    if not rows:
        raise SystemExit('Todavía no hay resúmenes reales. No se generaron resultados.')
    out=ROOT/'results'; out.mkdir(exist_ok=True)
    with (out/'results.csv').open('w',newline='',encoding='utf-8') as stream:
        writer=csv.DictWriter(stream,fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    (out/'performance.svg').write_text(chart(rows),encoding='utf-8')
    table=['| Destinatario | VU | Duración real (s) | RPS | Media ms | Mín ms | Máx ms | P95 ms | P99 ms | Errores % | Salida k6 |',
           '|---|---|---|---|---|---|---|---|---|---|---|']
    for r in rows:
        values=[r[k] for k in ['recipient','vus','elapsed_s','rps','avg_ms','min_ms','max_ms','p95_ms','p99_ms','error_pct','exit_code']]
        table.append('| '+' | '.join('Sin datos' if v is None else f'{v:.2f}' if isinstance(v,float) else str(v) for v in values)+' |')
    (out/'results.md').write_text('# Resultados medidos\n\n'+'\n'.join(table)+
        '\n\n![Rendimiento](performance.svg)\n\nLas ejecuciones detenidas no cumplen la duración completa. '+
        'El CSV separa solicitudes aceptadas y rechazos; las métricas HTTP no demuestran entrega de correo. '+
        'No se deduce un máximo de usuarios soportados sin evaluar también SQS, DLQ y errores del consumidor.\n',encoding='utf-8')
    print(f'Generados {out / "results.csv"}, results.md y performance.svg')

if __name__ == '__main__':
    main()
