# Fidelidade e campanhas

Tudo fica em **Fidelidade** (só gestora). O programa nasce **desligado**: ligue em Programa.

## Pontos, níveis, selos e ranking

- Pontos são lançados pelo servidor (nunca pelo app da cliente): atendimento concluído, presença confirmada, cadastro. Cada lançamento é único (sem pontos em dobro) e é estornado se o atendimento for apagado.
- O **nível** e o ranking usam os pontos ganhos; resgatar prêmio gasta saldo mas não rebaixa.
- Ranking é opcional: a cliente escolhe participar com um apelido. Só aparecem posição, apelido e pontos.
- "Calcular pontos do que já aconteceu" (Programa) credita o histórico uma vez.

## Prêmios

A cliente pede o resgate, os pontos ficam reservados, a gestora aprova, recusa ou marca como entregue.

## Campanhas

Sugestões prontas (saudade, aniversário, boas-vindas, confirme, perto do prêmio, perto do nível, indique, novidade). Edite texto e público, veja quantas receberiam e ligue.

- Variáveis: {nome}, {pontos}, {nivel}, {premio}, {faltam}.
- Limites globais: máximo por cliente na semana (padrão 2) e janela de horário (padrão 09:00–20:00).
- Quem desligou "Campanhas e novidades" no app nunca recebe. Só clientes com acesso ao app.
- Envio automático a cada 15 min (cron `eb-campaigns`), sem repetir para a mesma cliente dentro do prazo da campanha.
- "Marcaram" = clientes que agendaram em até 14 dias (atribuição aproximada).

## Tipos de notificação

| Tipo       | Quando                                                            | Preferência da cliente  |
| ---------- | ----------------------------------------------------------------- | ----------------------- |
| `reward`   | pontos, selo, nível                                               | Pontos, selos e prêmios |
| `redeem`   | pedido (gestora) e aprovado/recusado/entregue/cancelado (cliente) | Pontos, selos e prêmios |
| `campaign` | campanhas da gestora                                              | Campanhas e novidades   |
