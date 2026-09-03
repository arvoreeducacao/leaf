import { zipSync } from 'fflate'

const planHash = '1111111111111111111111111111aaaa'

const classHash = '2222222222222222222222222222bbbb'

const studentHash = '3333333333333333333333333333cccc'

const studentsHash = '4444444444444444444444444444dddd'

const anaHash = '5555555555555555555555555555eeee'

export const fixtureTitles = {
  plan: 'Reading plan',
  class: 'Class A',
  student: 'Featured student',
  students: 'Students',
  ana: 'Ana Souza',
}

export const fixturePaths = {
  plan: `Export-8f3a/${fixtureTitles.plan} ${planHash}.md`,
  class: `Export-8f3a/${fixtureTitles.plan} ${planHash}/${fixtureTitles.class} ${classHash}.md`,
  student: `Export-8f3a/${fixtureTitles.plan} ${planHash}/${fixtureTitles.class} ${classHash}/${fixtureTitles.student} ${studentHash}.md`,
  cover: `Export-8f3a/${fixtureTitles.plan} ${planHash}/${fixtureTitles.class} ${classHash}/cover.png`,
  attachment: `Export-8f3a/${fixtureTitles.plan} ${planHash}/${fixtureTitles.class} ${classHash}/rules.pdf`,
  students: `Export-8f3a/${fixtureTitles.plan} ${planHash}/${fixtureTitles.students} ${studentsHash}.csv`,
  ana: `Export-8f3a/${fixtureTitles.plan} ${planHash}/${fixtureTitles.students} ${studentsHash}/${fixtureTitles.ana} ${anaHash}.md`,
}

const pngBytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
])

const planMarkdown = [
  `# ${fixtureTitles.plan}`,
  '',
  'Term outline with the participating classes.',
  '',
  `[${fixtureTitles.class}](${encodeURIComponent(`${fixtureTitles.plan} ${planHash}`)}/${encodeURIComponent(`${fixtureTitles.class} ${classHash}`)}.md)`,
  '',
  '<aside>',
  'Agree on the dates with the coordination before publishing.',
  '</aside>',
  '',
  '<details>',
  '<summary>Support material</summary>',
  '',
  'List of complementary readings.',
  '',
  '</details>',
  '',
].join('\n')

const classMarkdown = [
  `# ${fixtureTitles.class}`,
  '',
  '> 💡 The class reads twice a week.',
  '',
  `![Cover](${encodeURIComponent(`${fixtureTitles.class} ${classHash}`)}/cover.png)`,
  '',
  `[Rules](${encodeURIComponent(`${fixtureTitles.class} ${classHash}`)}/rules.pdf)`,
  '',
  `[${fixtureTitles.student}](${encodeURIComponent(`${fixtureTitles.class} ${classHash}`)}/${encodeURIComponent(`${fixtureTitles.student} ${studentHash}`)}.md)`,
  '',
].join('\n')

const studentMarkdown = [
  `# ${fixtureTitles.student}`,
  '',
  'Review of the month written by the student.',
  '',
].join('\n')

const anaMarkdown = [
  `# ${fixtureTitles.ana}`,
  '',
  'Reading record of the student.',
  '',
].join('\n')

const studentsCsv = [
  'Name,Books,Comment',
  `${fixtureTitles.ana},12,"Avid reader, likes biographies"`,
  'Bruno Lima,7,Prefers comics',
].join('\n')

function encode(text: string) {
  return new TextEncoder().encode(text)
}

export function buildNotionFixtureZip(): Uint8Array {
  return zipSync({
    [fixturePaths.plan]: encode(planMarkdown),
    [fixturePaths.class]: encode(classMarkdown),
    [fixturePaths.student]: encode(studentMarkdown),
    [fixturePaths.cover]: pngBytes,
    [fixturePaths.attachment]: encode('%PDF-1.4 content'),
    [fixturePaths.students]: encode(studentsCsv),
    [fixturePaths.ana]: encode(anaMarkdown),
  })
}
