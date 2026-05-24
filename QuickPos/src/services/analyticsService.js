import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Service to calculate complex business analytics
 * (e.g., Dead stock, top-selling products)
 */
export const getAdvancedAnalytics = async (tenantId) => {
  const productsQ = query(collection(db, 'pos_products'), where('tenantId', '==', tenantId));
  const recordsQ = query(collection(db, 'pos_records'), where('tenantId', '==', tenantId), orderBy('timestamp', 'desc'));

  const [productsSnap, recordsSnap] = await Promise.all([
    getDocs(productsQ),
    getDocs(recordsQ)
  ]);

  const productSalesMap = {};
  
  // Initialize map with all products to track dead stock
  productsSnap.forEach(doc => {
    productSalesMap[doc.id] = { ...doc.data(), id: doc.id, totalSold: 0 };
  });

  // Calculate actual sold quantities
  recordsSnap.forEach(doc => {
    const record = doc.data();
    if (record.items) {
      record.items.forEach(item => {
        if (productSalesMap[item.id]) {
          productSalesMap[item.id].totalSold += item.quantity;
        }
      });
    }
  });

  const allProductsArray = Object.values(productSalesMap);

  // Top Selling Products (Sorted by totalSold DESC)
  const topSelling = [...allProductsArray]
    .filter(p => p.totalSold > 0)
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, 10);

  // Dead Stock (Products with 0 sales but have stock > 0)
  const deadStock = allProductsArray
    .filter(p => p.totalSold === 0 && p.stock > 0);

  return { topSelling, deadStock };
};
