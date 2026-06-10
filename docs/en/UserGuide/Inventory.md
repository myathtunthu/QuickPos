# Inventory User Guide

Use the Inventory page to create products, manage stock, configure barcodes, and set up units of measurement for Myanmar retail workflows. Inventory accuracy affects sales, purchasing, profit reports, low-stock alerts, and cashier search results.

## 1. What Inventory is used for

- Create and edit products.
- Manage cost price, sale price, barcode, category, and opening stock.
- Configure base units and sale units.
- Set low-stock and reorder warning levels.
- Support Myanmar units such as viss, tical, tin, pyi, carton, and pack.
- Keep product data consistent for POS checkout and reports.

## 2. Product creation

1. Open **Inventory**.
2. Tap **Add Product**.
3. Enter a clear product name.
4. Choose or create a category.
5. Enter cost price and sale price.
6. Choose the correct base unit.
7. Enter opening stock.
8. Add barcode if available.
9. Save the product.

## 3. Field meanings

### Product name

Use a clear name that cashiers can search quickly. Include brand, size, and unit when useful.

### Cost price

Cost price is used to calculate profit. If cost price is wrong, profit reports will also be wrong.

### Sale price

Sale price is the normal selling price shown at POS checkout.

### Stock

Stock should be stored in the product base unit. Sale units are converted back to the base unit during checkout.

### Minimum stock

Minimum stock is used for low-stock warnings and reorder decisions.

### Barcode

A barcode should identify only one product or one package unit. Avoid duplicate barcodes.

## 4. Units of measurement

The system supports both international and Myanmar local units.

- Count units: pcs, dozen, pack, carton, case, set
- Weight units: g, kg, ton, viss, tical, peh
- Rice and grain units: tin, pyi, cup/can
- Volume units: ml, liter, US gallon, UK gallon
- Length units: mm, cm, m, inch, ft, yard, roll

## 5. Myanmar UOM examples

- 1 viss = 100 tical
- 1 tical = 16 peh
- 1 viss is approximately 1.633 kg
- 1 kg = 1000 g
- 1 tin = 16 pyi
- 1 liter = 1000 ml

## 6. Multi-unit setup

Use one base unit for stock keeping. Add sale units with multipliers so staff can sell in different units.

Example for rice:

- Base unit: kg
- Sale units: kg, viss, tical, pyi, tin, bag
- If a customer buys 1 pyi, the system converts the sale quantity to base stock using the product multiplier.

## 7. Barcode rules

- Use one barcode per product if the product is sold only as one unit.
- Use unit barcodes when the same product can be sold by bottle, carton, or pack.
- Do not reuse the same barcode for two different products.
- Test scanner input before training staff.

## 8. Low-stock workflow

1. Set minimum stock for important products.
2. Check low-stock alerts daily.
3. Restock fast-moving products before they reach zero.
4. Use reports to confirm which products sell fastest.

## 9. Stock adjustment

Use stock adjustment when physical stock does not match system stock. Always enter a reason, such as damaged item, stock count correction, giveaway, or opening balance correction.

## 10. Best practices

- Keep cost price accurate because profit reports depend on it.
- Do not delete products with transaction history. Mark them inactive instead.
- Use categories consistently.
- Check stock after purchases, returns, and adjustments.
- Review duplicate barcodes before going live.
