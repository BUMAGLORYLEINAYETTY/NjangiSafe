const { v4: uuidv4 } = require('uuid');

class MtnService {
    async requestToPay(phone, amount, externalId) {
        // Ici, on simule le délai de l'API réelle
        console.log(`[MTN SIMULATOR] Connexion au réseau MTN...`);
        console.log(`[MTN SIMULATOR] Push USSD envoyé au ${phone} pour ${amount} FCFA`);
        
        // On retourne une référence comme le ferait la vraie API
        return uuidv4();
    }

    async getTransactionStatus(referenceId) {
        // Simule que le paiement est toujours réussi après l'appel
        return "SUCCESSFUL";
    }
}

module.exports = new MtnService();