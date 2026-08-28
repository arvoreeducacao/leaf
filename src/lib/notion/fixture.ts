import { zipSync } from 'fflate'

const planoHash = '1111111111111111111111111111aaaa'

const turmaHash = '2222222222222222222222222222bbbb'

const alunoHash = '3333333333333333333333333333cccc'

const alunosHash = '4444444444444444444444444444dddd'

const anaHash = '5555555555555555555555555555eeee'

export const fixtureTitles = {
  plano: 'Plano de leitura',
  turma: 'Turma A',
  aluno: 'Aluno destaque',
  alunos: 'Alunos',
  ana: 'Ana Souza',
}

export const fixturePaths = {
  plano: `Export-8f3a/${fixtureTitles.plano} ${planoHash}.md`,
  turma: `Export-8f3a/${fixtureTitles.plano} ${planoHash}/${fixtureTitles.turma} ${turmaHash}.md`,
  aluno: `Export-8f3a/${fixtureTitles.plano} ${planoHash}/${fixtureTitles.turma} ${turmaHash}/${fixtureTitles.aluno} ${alunoHash}.md`,
  capa: `Export-8f3a/${fixtureTitles.plano} ${planoHash}/${fixtureTitles.turma} ${turmaHash}/capa.png`,
  anexo: `Export-8f3a/${fixtureTitles.plano} ${planoHash}/${fixtureTitles.turma} ${turmaHash}/regras.pdf`,
  alunos: `Export-8f3a/${fixtureTitles.plano} ${planoHash}/${fixtureTitles.alunos} ${alunosHash}.csv`,
  ana: `Export-8f3a/${fixtureTitles.plano} ${planoHash}/${fixtureTitles.alunos} ${alunosHash}/${fixtureTitles.ana} ${anaHash}.md`,
}

const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
])

const planoMarkdown = [
  `# ${fixtureTitles.plano}`,
  '',
  'Roteiro do trimestre com as turmas participantes.',
  '',
  `[${fixtureTitles.turma}](${encodeURIComponent(`${fixtureTitles.plano} ${planoHash}`)}/${encodeURIComponent(`${fixtureTitles.turma} ${turmaHash}`)}.md)`,
  '',
  '<aside>',
  'Combine as datas com a coordenação antes de publicar.',
  '</aside>',
  '',
  '<details>',
  '<summary>Materiais de apoio</summary>',
  '',
  'Lista de leituras complementares.',
  '',
  '</details>',
  '',
].join('\n')

const turmaMarkdown = [
  `# ${fixtureTitles.turma}`,
  '',
  '> 💡 A turma lê duas vezes por semana.',
  '',
  `![Capa](${encodeURIComponent(`${fixtureTitles.turma} ${turmaHash}`)}/capa.png)`,
  '',
  `[Regras](${encodeURIComponent(`${fixtureTitles.turma} ${turmaHash}`)}/regras.pdf)`,
  '',
  `[${fixtureTitles.aluno}](${encodeURIComponent(`${fixtureTitles.turma} ${turmaHash}`)}/${encodeURIComponent(`${fixtureTitles.aluno} ${alunoHash}`)}.md)`,
  '',
].join('\n')

const alunoMarkdown = [
  `# ${fixtureTitles.aluno}`,
  '',
  'Resenha do mês escrita pelo estudante.',
  '',
].join('\n')

const anaMarkdown = [
  `# ${fixtureTitles.ana}`,
  '',
  'Ficha de leitura da estudante.',
  '',
].join('\n')

const alunosCsv = [
  'Nome,Livros,Comentário',
  `${fixtureTitles.ana},12,"Leitora assídua, gosta de biografias"`,
  'Bruno Lima,7,Prefere quadrinhos',
].join('\n')

function encode(text: string) {
  return new TextEncoder().encode(text)
}

export function buildNotionFixtureZip(): Uint8Array {
  return zipSync({
    [fixturePaths.plano]: encode(planoMarkdown),
    [fixturePaths.turma]: encode(turmaMarkdown),
    [fixturePaths.aluno]: encode(alunoMarkdown),
    [fixturePaths.capa]: pngBytes,
    [fixturePaths.anexo]: encode('%PDF-1.4 conteudo'),
    [fixturePaths.alunos]: encode(alunosCsv),
    [fixturePaths.ana]: encode(anaMarkdown),
  })
}
