const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch"); // requires node-fetch v2

admin.initializeApp();
const db = admin.firestore();

/**
 * Scheduled Cloud Function (Runs every day at 11:59 PM)
 * Extracts daily sales summary per tenant and sends it to their Telegram Bot
 */
exports.dailyTelegramBackup = functions.pubsub.schedule("59 23 * * *")
  .timeZone("Asia/Yangon") // Myanmar Time
  .onRun(async (context) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all tenants who have telegram integration enabled
      const tenantsSnap = await db.collection("settings").where("telegramBackup", "==", true).get();
      
      if (tenantsSnap.empty) return null;

      for (const tenantDoc of tenantsSnap.docs) {
        const tenantId = tenantDoc.id;
        const settings = tenantDoc.data();
        
        if (!settings.botToken || !settings.chatId) continue;

        // Query today's sales for this tenant
        const salesSnap = await db.collection("pos_records")
          .where("tenantId", "==", tenantId)
          .where("timestamp", ">=", today)
          .get();

        let dailyTotal = 0;
        let transactionCount = salesSnap.size;

        salesSnap.forEach(doc => {
          dailyTotal += doc.data().total;
        });

        // Format message
        const message = `
📊 *CyberPOS Daily Summary*
🏢 Store: ${settings.storeName || tenantId}
📅 Date: ${today.toLocaleDateString('en-GB')}

💰 Total Revenue: *${dailyTotal.toLocaleString()} MMK*
🧾 Transactions: ${transactionCount}

_Automated cloud backup generated._
        `;

        // Send to Telegram
        await fetch(`https://api.telegram.org/bot${settings.botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: settings.chatId,
            text: message,
            parse_mode: "Markdown"
          })
        });
      }

      console.log("Daily backup executed successfully");
      return null;
    } catch (error) {
      console.error("Backup failed:", error);
      return null;
    }
});
