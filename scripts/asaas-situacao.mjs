// Confere a ligação com o Asaas (conta e ambiente) e, com --webhook, cadastra ou atualiza o webhook do Portal.
// Lê ASAAS_CHAVE e ASAAS_WEBHOOK_TOKEN do ambiente (segredos do GitHub). Não imprime chave nem token.
import { situacaoAsaas } from '../functions/asaas.js';
const r = await situacaoAsaas(process.argv.includes('--webhook'));
console.log(`::notice::Asaas · ambiente ${r.ambiente} · conta ${r.conta.erro ? 'ERRO: ' + r.conta.erro : (r.conta.nome || '?') + ' (' + (r.conta.pessoa || '?') + ')'}`);
console.log(`::notice::Endereço do webhook: ${r.url}${r.webhook ? ' · ' + r.webhook : ''}`);
if (r.conta.erro || (r.webhook && /^erro/.test(r.webhook))) process.exit(1);
