const Njangi = require('../models/Njangi');
const mtnService = require('../services/mtnService');

exports.contribute = async (req, res) => {
    const { njangiId, userId, phone } = req.body;

    try {
        const group = await Njangi.findById(njangiId);
        if (!group) return res.status(404).json({ error: "Groupe non trouvé" });

        const externalId = `NJ-${Date.now()}`;
        
        // Appel au service (qui est en mode simulation pour l'instant)
        const refId = await mtnService.requestToPay(phone, group.contributionAmount, externalId);

        // Validation automatique du membre
        const member = group.members.find(m => m.userId === userId);
        if (member) member.hasPaid = true;

        // Vérification si le tour est fini (Rotation de la tontine)
        const allPaid = group.members.every(m => m.hasPaid);
        if (allPaid) {
            const totalPot = group.contributionAmount * group.members.length;
            const winner = group.members[group.currentWinnerIndex];

            // Règle NjangiSafe : 40% bloqués
            const escrowAmount = totalPot * 0.4;
            
            let userEscrow = group.escrowLedger.find(e => e.userId === winner.userId);
            if (userEscrow) {
                userEscrow.amountHeld += escrowAmount;
            } else {
                group.escrowLedger.push({ userId: winner.userId, amountHeld: escrowAmount });
            }

            // Reset pour le prochain cycle
            group.members.forEach(m => m.hasPaid = false);
            group.currentWinnerIndex = (group.currentWinnerIndex + 1) % group.members.length;
            
            console.log(`[NJANGISAFE] Cycle complété. Gagnant payé à 60%. ${escrowAmount} FCFA sécurisés.`);
        }

        await group.save();
        res.status(200).json({ 
            status: "PAID_SIMULATED", 
            message: "Paiement validé par le simulateur MTN",
            mtnReference: refId,
            groupState: group
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};