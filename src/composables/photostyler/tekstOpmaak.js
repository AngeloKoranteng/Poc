// Elke letter krijgt een getal:
// 0 = normaal, 1 = vet, 2 = cursief, 3 = beide.
export function leesOpmaak(tekst) {
    const standaard = (tekst.vet ? 1 : 0) | (tekst.cursief ? 2 : 0);

    return Array.from(
        { length: tekst.inhoud.length },
        (_, index) => tekst.opmaak?.[index] ?? standaard,
    );
}

// Houdt opmaak bij de bestaande letters wanneer je tekst wijzigt.
export function wijzigInhoud(tekst, inhoud) {
    const vorige = tekst.inhoud;
    const opmaak = leesOpmaak(tekst);
    let begin = 0;
    let eindeOud = vorige.length;
    let eindeNieuw = inhoud.length;

    while (
        begin < eindeOud &&
        begin < eindeNieuw &&
        vorige[begin] === inhoud[begin]
        ) {
        begin++;
    }

    while (
        eindeOud > begin &&
        eindeNieuw > begin &&
        vorige[eindeOud - 1] === inhoud[eindeNieuw - 1]
        ) {
        eindeOud--;
        eindeNieuw--;
    }

    const invoerOpmaak = opmaak[begin] ?? opmaak[begin - 1] ?? 0;

    return {
        ...tekst,
        inhoud,
        opmaak: [
            ...opmaak.slice(0, begin),
            ...Array(eindeNieuw - begin).fill(invoerOpmaak),
            ...opmaak.slice(eindeOud),
        ],
    };
}

// Zet de letters om naar tekst met PixiJS-opmaaktags.
export function maakCanvasTekst(tekst) {
    const opmaak = leesOpmaak(tekst);

    // Voorkomt dat zelf getypte tags als opmaak worden behandeld.
    let prefix = "letterstijl";
    while (tekst.inhoud.includes(prefix)) prefix += "_";

    const tagStyles = {};
    for (let waarde = 0; waarde < 4; waarde++) {
        tagStyles[`${prefix}${waarde}`] = {
            fontWeight: waarde & 1 ? "bold" : "normal",
            fontStyle: waarde & 2 ? "italic" : "normal",
        };
    }

    let text = "";
    let begin = 0;

    while (begin < tekst.inhoud.length) {
        const waarde = opmaak[begin];
        let einde = begin + 1;

        while (einde < tekst.inhoud.length && opmaak[einde] === waarde) {
            einde++;
        }

        const tag = `${prefix}${waarde}`;
        text += `<${tag}>${tekst.inhoud.slice(begin, einde)}</${tag}>`;
        begin = einde;
    }

    return { text, tagStyles };
}