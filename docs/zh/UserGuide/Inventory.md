# 库存使用指南

库存页面用于新增商品、管理库存、设置条码和配置计量单位，支持缅甸本地零售单位。

## 1. 新增商品

1. 打开 **Inventory**。
2. 点击 **Add Product**。
3. 输入商品名称、分类、条码、成本价、售价和初始库存。
4. 选择正确的基础单位。
5. 保存商品。

## 2. 计量单位

系统支持国际单位和缅甸本地单位。

- 数量单位：pcs、dozen、pack、carton、set
- 重量单位：g、kg、ton、viss、tical、peh
- 米/谷物单位：tin、pyi、cup/can
- 容量单位：ml、liter、US gallon、UK gallon
- 长度单位：mm、cm、m、inch、ft、yard、roll

## 3. 缅甸单位示例

- 1 viss = 100 tical
- 1 tical = 16 peh
- 1 kg = 1000 g
- 1 tin = 16 pyi
- 1 liter = 1000 ml

## 4. 多单位设置

库存应使用一个基础单位保存。销售单位通过 multiplier 转换成基础单位。

## 5. 最佳实践

- 成本价要准确，因为利润报表依赖成本价。
- 有交易记录的商品不要直接删除，建议停用。
- 采购、销售、调整后要检查库存。
