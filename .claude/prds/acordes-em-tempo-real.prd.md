# Acordes em Tempo Real — assistente de estudo de guitarra

## Problema
Aprender uma música na guitarra hoje exige alternar entre o player de áudio e uma
cifra escrita por terceiros, pausando e rebobinando manualmente para casar o que
se ouve com o que se lê. A cifra nem sempre existe, nem sempre está correta, e
nunca está sincronizada com a gravação — o esforço de sincronização manual é
repetido a cada sessão de estudo e compete com o tempo de efetivamente tocar.

## Evidence
- Necessidade própria do autor, que é também o único usuário-alvo. `Assumption —
  não validada externamente, e não precisa ser: o custo de estar errado é baixo.`
- Existe prior art madura e de código aberto resolvendo exatamente este problema
  de ponta a ponta (`/Users/joaovictorbalvedi/code/projects/sonarcan`, MIT), o que
  torna a viabilidade técnica um fato observado, não uma aposta.
- `TBD — needs validation via uso próprio`: se ver o acorde sincronizado de fato
  encurta o tempo até tocar a música inteira, ou se o gargalo real é a execução
  manual das transições.

## Users
- **Primary**: o autor — guitarrista estudando repertório sozinho, no desktop,
  com o instrumento nas mãos. O gatilho é "quero tocar esta música específica".
- **Not for**: qualquer outra pessoa. Não há distribuição, onboarding, contas,
  telemetria ou suporte a múltiplos usuários no escopo. Uso pessoal e local.

## Hypothesis
Acreditamos que **mostrar os acordes detectados da própria gravação, sincronizados
com a reprodução e com o desenho no braço da guitarra**, vai **eliminar o trabalho
manual de casar cifra com áudio** para **o autor estudando repertório**.
Saberemos que estamos certos quando **for possível pegar uma música desconhecida e
tocá-la junto usando só o aplicativo, sem abrir cifra em outro lugar**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Música desconhecida → tocando junto | Sem consultar cifra externa | Uso próprio, observação direta |
| Confiança dos acordes detectados | Acertos suficientes para não atrapalhar o estudo | Comparação pontual com cifra conhecida em 3–5 músicas de referência |
| Tempo de preparo de uma música | `TBD — medir após o Marco 1` | Do arquivo importado até os acordes na tela |
| Reprodução sincronizada | Acorde na tela corresponde ao que se ouve | Percepção própria durante o uso |

## Scope

**MVP** — Importar uma música, ver seus acordes correndo numa timeline
sincronizada com o áudio, com o diagrama do acorde atual no braço da guitarra,
e poder isolar instrumentos para ouvir só a guitarra ou só o baixo.

Os quatro itens abaixo foram marcados como indispensáveis pelo usuário e estão
todos dentro do escopo. A ordenação em marcos é uma decisão de sequenciamento,
não um corte de escopo:

- Detecção de acordes com marcação de tempo, a partir do áudio da própria gravação
- Reprodução com timeline rolante de acordes acompanhando a posição atual
- Diagrama visual do acorde no braço da guitarra
- Importação de arquivo local de áudio
- Busca e importação a partir do YouTube, pelo nome da música
- Repertório persistente: o que entrou fica guardado e é reaberto sem reimportar
- Separação da música em stems, com controle de volume por instrumento

**Out of scope**
- Multiusuário, contas, sincronização em nuvem — uso estritamente local e pessoal.
- Edição ou correção manual dos acordes detectados — depende de saber primeiro
  quão frequentemente o modelo erra.
- Transposição, mudança de andamento e loops de treino — valiosos, mas são
  ferramentas de ensaio, não do laço "ver o acorde certo na hora certa".
- Partitura, tablatura nota a nota, exportação — problema diferente.
- Empacotamento, instalador, assinatura de código, suporte multiplataforma —
  roda na máquina do autor a partir do código-fonte.
- Outros instrumentos além da guitarra na visualização do braço.

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Tocar junto com uma música | Busco uma música pelo nome ou abro um arquivo do computador, dou play e vejo os acordes correndo na timeline em sincronia com o áudio. É a primeira versão utilizável de verdade. | complete | `.claude/plans/acordes-em-tempo-real.plan.md` |
| 2 | Ver como formar o acorde | O acorde atual aparece desenhado no braço da guitarra, não só como nome. Fecha o laço para acordes que ainda não sei formar de cabeça. | complete | — |
| 3 | Ter um repertório que persiste | O que eu importo ou baixo fica guardado. Abro o aplicativo e a música que estudei ontem está lá, sem baixar nem procurar o arquivo de novo. | in-progress | `.claude/plans/biblioteca.plan.md` |
| 4 | Isolar instrumentos | Separo a música em stems e escuto só a guitarra para conferir o que estou tocando, ou tiro a guitarra para tocar por cima. | pending | — |

## Open Questions
- [ ] Qual a precisão aceitável na prática? Um acorde errado a cada seção atrapalha
      mais do que ajuda, ou passa despercebido? Só o uso do Marco 1 responde.
- [ ] O que acontece com músicas onde a detecção falha feio? O aplicativo mostra
      o resultado ruim, avisa a baixa confiança, ou não mostra nada?
- [ ] A timeline rolante e o diagrama de braço convivem na mesma tela, ou competem
      pela atenção de quem está com a guitarra na mão e olha de relance?
- [ ] A detecção roda uma vez e fica guardada por música, ou reprocessa a cada
      abertura? Define se existe a noção de "projeto salvo".
- [ ] Stems servem só para ouvir, ou também alimentam a detecção de acordes? A
      prior art usa o áudio original para detectar, o que sugere manter separados.
- [ ] Vale reaproveitar os modelos e as escolhas técnicas da prior art, ou isso
      amarra o projeto a decisões que não entendo ainda? Questão para o `/plan`.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Escopo do MVP grande demais: quatro peças de infraestrutura independentes antes de qualquer uso real | Alta | Alta — projeto pessoal que não chega ao fim é o modo de falha mais comum | Marcos verticais: o Marco 1 já é utilizável sozinho; cada marco seguinte agrega sem retrabalho |
| Precisão da detecção automática abaixo do que serve para estudar | Média | Alta — invalida a hipótese central | Testar cedo, no Marco 1, contra músicas cuja cifra já conheço |
| Processamento local pesado (modelos de ML) torna o preparo lento demais para o uso casual | Média | Média | Guardar resultado por música; processar uma vez, estudar várias |
| Baixar áudio do YouTube contraria os termos de uso da plataforma | Alta | Baixa no contexto — uso pessoal, local, sem redistribuição; decisão consciente do autor | Registrado aqui como decisão informada, não como descuido |
| Construir do zero problemas já resolvidos pela prior art custa semanas | Média | Média | Consultar a prior art como referência de arquitetura a cada marco |
| Dependência de ferramentas externas para importação e separação quebra com atualizações | Média | Baixa | Fixar versões; falha degrada uma funcionalidade, não o aplicativo |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
