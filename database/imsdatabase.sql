CREATE DATABASE IF NOT EXISTS `imsdatabase` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE imsdatabase;
-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: imsdatabase
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `__efmigrationshistory`
--

DROP TABLE IF EXISTS `__efmigrationshistory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__efmigrationshistory` (
  `MigrationId` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductVersion` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`MigrationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `__efmigrationshistory`
--

LOCK TABLES `__efmigrationshistory` WRITE;
/*!40000 ALTER TABLE `__efmigrationshistory` DISABLE KEYS */;
INSERT INTO `__efmigrationshistory` VALUES ('20260427121016_InitialCreate','8.0.0'),('20260710181130_UpdateLoginHistory','8.0.0'),('20260711115855_AddAccountLockout','8.0.0'),('20260711131140_AddEmailVerification','8.0.0'),('20260713044929_AddPurchaseIndentModule','8.0.0'),('20260724142758_AddPendingUsers','8.0.0'),('20260730050421_AddPurchaseReturnModule','8.0.0'),('20260730074105_AddGrnNumber','8.0.0'),('20260731072247_AddLoginOtpSupport','8.0.0'),('20260806075627_AddSupplierInvoiceFields','8.0.0'),('20260806082243_AddDiscountTaxLineTotalToGoodsReceiptItems','8.0.0'),('20260806083928_AddDiscountAndTaxToPurchaseOrderItems','8.0.0');
/*!40000 ALTER TABLE `__efmigrationshistory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attribute_values`
--

DROP TABLE IF EXISTS `attribute_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attribute_values` (
  `value_id` int NOT NULL AUTO_INCREMENT,
  `attribute_id` int DEFAULT NULL,
  `value` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`value_id`),
  KEY `attribute_id` (`attribute_id`),
  CONSTRAINT `attribute_values_ibfk_1` FOREIGN KEY (`attribute_id`) REFERENCES `attributes` (`attribute_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attribute_values`
--

LOCK TABLES `attribute_values` WRITE;
/*!40000 ALTER TABLE `attribute_values` DISABLE KEYS */;
/*!40000 ALTER TABLE `attribute_values` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attributes`
--

DROP TABLE IF EXISTS `attributes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attributes` (
  `attribute_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`attribute_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attributes`
--

LOCK TABLES `attributes` WRITE;
/*!40000 ALTER TABLE `attributes` DISABLE KEYS */;
/*!40000 ALTER TABLE `attributes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(100) DEFAULT NULL,
  `module` varchar(100) DEFAULT NULL,
  `record_id` int DEFAULT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `table_name` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`log_id`),
  KEY `idx_audit_logs_created_at` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `barcodes`
--

DROP TABLE IF EXISTS `barcodes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `barcodes` (
  `barcode_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `code_value` varchar(255) DEFAULT NULL,
  `code_type` varchar(50) DEFAULT NULL,
  `image_url` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`barcode_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `barcodes`
--

LOCK TABLES `barcodes` WRITE;
/*!40000 ALTER TABLE `barcodes` DISABLE KEYS */;
/*!40000 ALTER TABLE `barcodes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bin_stock`
--

DROP TABLE IF EXISTS `bin_stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bin_stock` (
  `bin_stock_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `bin_id` int DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`bin_stock_id`),
  UNIQUE KEY `product_id` (`product_id`,`variant_id`,`bin_id`),
  KEY `variant_id` (`variant_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `bin_id` (`bin_id`),
  CONSTRAINT `bin_stock_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
  CONSTRAINT `bin_stock_ibfk_2` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`),
  CONSTRAINT `bin_stock_ibfk_3` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`),
  CONSTRAINT `bin_stock_ibfk_4` FOREIGN KEY (`bin_id`) REFERENCES `bins` (`bin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bin_stock`
--

LOCK TABLES `bin_stock` WRITE;
/*!40000 ALTER TABLE `bin_stock` DISABLE KEYS */;
/*!40000 ALTER TABLE `bin_stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bin_transfer_audits`
--

DROP TABLE IF EXISTS `bin_transfer_audits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bin_transfer_audits` (
  `bin_transfer_audit_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `variant_id` int DEFAULT NULL,
  `warehouse_id` int NOT NULL,
  `from_bin_id` int NOT NULL,
  `to_bin_id` int NOT NULL,
  `quantity` decimal(18,2) NOT NULL,
  `user_id` int DEFAULT NULL,
  `user_name` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`bin_transfer_audit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bin_transfer_audits`
--

LOCK TABLES `bin_transfer_audits` WRITE;
/*!40000 ALTER TABLE `bin_transfer_audits` DISABLE KEYS */;
/*!40000 ALTER TABLE `bin_transfer_audits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bins`
--

DROP TABLE IF EXISTS `bins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bins` (
  `bin_id` int NOT NULL AUTO_INCREMENT,
  `warehouse_id` int DEFAULT NULL,
  `rack_id` int DEFAULT NULL,
  `bin_code` varchar(50) DEFAULT NULL,
  `capacity` decimal(10,2) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  PRIMARY KEY (`bin_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `rack_id` (`rack_id`),
  CONSTRAINT `bins_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`),
  CONSTRAINT `bins_ibfk_2` FOREIGN KEY (`rack_id`) REFERENCES `racks` (`rack_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bins`
--

LOCK TABLES `bins` WRITE;
/*!40000 ALTER TABLE `bins` DISABLE KEYS */;
INSERT INTO `bins` VALUES (1,2,1,'BIN-A1',100.00,'active'),(2,2,1,'BIN-A2',100.00,'active');
/*!40000 ALTER TABLE `bins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `brands`
--

DROP TABLE IF EXISTS `brands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `brands` (
  `brand_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `description` text,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`brand_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `brands`
--

LOCK TABLES `brands` WRITE;
/*!40000 ALTER TABLE `brands` DISABLE KEYS */;
INSERT INTO `brands` VALUES (1,'IMS Software','',0),(2,'CloudNova','',0),(3,'SecureShield','',0),(4,'DevForge','',0),(5,'Generic','',0);
/*!40000 ALTER TABLE `brands` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `parent_id` int DEFAULT NULL,
  `description` text,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`category_id`),
  KEY `parent_id` (`parent_id`),
  CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `categories` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES (1,'Software Licenses',NULL,'Perpetual and term licenses for business and productivity software',0),(2,'SaaS & Subscriptions',NULL,'Recurring cloud-delivered applications',0),(3,'Cloud & Hosting',NULL,'Compute, storage, domains and certificates',0),(4,'Security Solutions',NULL,'Endpoint, network and data protection products',0),(5,'Developer Tools',NULL,'Tools for building, testing and monitoring software',0),(6,'Support & Services',NULL,'Maintenance, training and professional services',0);
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_activity`
--

DROP TABLE IF EXISTS `customer_activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_activity` (
  `activity_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `activity_type` varchar(50) DEFAULT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`activity_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `customer_activity_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_activity`
--

LOCK TABLES `customer_activity` WRITE;
/*!40000 ALTER TABLE `customer_activity` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_activity` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_addresses`
--

DROP TABLE IF EXISTS `customer_addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_addresses` (
  `address_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `address_type` enum('billing','shipping') DEFAULT 'billing',
  `address_line` text,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `pincode` varchar(20) DEFAULT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`address_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `customer_addresses_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_addresses`
--

LOCK TABLES `customer_addresses` WRITE;
/*!40000 ALTER TABLE `customer_addresses` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_addresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_bank_details`
--

DROP TABLE IF EXISTS `customer_bank_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_bank_details` (
  `bank_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `account_name` varchar(150) DEFAULT NULL,
  `account_number` varchar(50) DEFAULT NULL,
  `bank_name` varchar(150) DEFAULT NULL,
  `ifsc_code` varchar(20) DEFAULT NULL,
  `branch` varchar(100) DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`bank_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `customer_bank_details_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_bank_details`
--

LOCK TABLES `customer_bank_details` WRITE;
/*!40000 ALTER TABLE `customer_bank_details` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_bank_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_contacts`
--

DROP TABLE IF EXISTS `customer_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_contacts` (
  `contact_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `name` varchar(150) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT '0',
  `role` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`contact_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `customer_contacts_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_contacts`
--

LOCK TABLES `customer_contacts` WRITE;
/*!40000 ALTER TABLE `customer_contacts` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_contacts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_ledger`
--

DROP TABLE IF EXISTS `customer_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_ledger` (
  `ledger_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `transaction_type` enum('invoice','payment','return','return_credit_note','return_refund','payment_edit','payment_void','invoice_reversal','invoice_cancel') DEFAULT NULL,
  `transaction_id` int DEFAULT NULL,
  `debit` decimal(12,2) DEFAULT '0.00',
  `credit` decimal(12,2) DEFAULT '0.00',
  `balance` decimal(12,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ledger_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `customer_ledger_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_ledger`
--

LOCK TABLES `customer_ledger` WRITE;
/*!40000 ALTER TABLE `customer_ledger` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_ledger` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_payment_terms`
--

DROP TABLE IF EXISTS `customer_payment_terms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_payment_terms` (
  `term_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int NOT NULL,
  `credit_days` int DEFAULT '0',
  `credit_limit` decimal(12,2) DEFAULT '0.00',
  `payment_mode` varchar(50) DEFAULT NULL,
  `notes` text,
  `payment_method` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`term_id`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `customer_payment_terms_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_payment_terms`
--

LOCK TABLES `customer_payment_terms` WRITE;
/*!40000 ALTER TABLE `customer_payment_terms` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_payment_terms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_payments`
--

DROP TABLE IF EXISTS `customer_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_payments` (
  `payment_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int DEFAULT NULL,
  `invoice_id` int DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `payment_date` datetime DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `notes` text,
  `is_cancelled` tinyint(1) NOT NULL DEFAULT '0',
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_reason` text,
  PRIMARY KEY (`payment_id`),
  KEY `customer_id` (`customer_id`),
  KEY `invoice_id` (`invoice_id`),
  CONSTRAINT `customer_payments_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`),
  CONSTRAINT `customer_payments_ibfk_2` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_payments`
--

LOCK TABLES `customer_payments` WRITE;
/*!40000 ALTER TABLE `customer_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `customer_id` int NOT NULL AUTO_INCREMENT,
  `customer_code` varchar(50) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `gst_number` varchar(50) DEFAULT NULL,
  `pan_number` varchar(20) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company` varchar(150) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `credit_limit` decimal(12,2) DEFAULT '0.00',
  `outstanding_balance` decimal(12,2) DEFAULT '0.00',
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `customer_code` (`customer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cycle_counts`
--

DROP TABLE IF EXISTS `cycle_counts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cycle_counts` (
  `cycle_id` int NOT NULL AUTO_INCREMENT,
  `warehouse_id` int DEFAULT NULL,
  `frequency` enum('daily','weekly','monthly') DEFAULT NULL,
  `last_run` date DEFAULT NULL,
  `next_run` date DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  PRIMARY KEY (`cycle_id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `cycle_counts_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cycle_counts`
--

LOCK TABLES `cycle_counts` WRITE;
/*!40000 ALTER TABLE `cycle_counts` DISABLE KEYS */;
/*!40000 ALTER TABLE `cycle_counts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goods_receipt_items`
--

DROP TABLE IF EXISTS `goods_receipt_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods_receipt_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `grn_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `quantity_received` decimal(10,2) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `discount` decimal(65,30) DEFAULT NULL,
  `line_total` decimal(65,30) DEFAULT NULL,
  `tax` decimal(65,30) DEFAULT NULL,
  `tax_percentage` decimal(10,2) NOT NULL DEFAULT '0.00',
  `taxable_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(18,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `grn_id` (`grn_id`),
  CONSTRAINT `goods_receipt_items_ibfk_1` FOREIGN KEY (`grn_id`) REFERENCES `goods_receipts` (`grn_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goods_receipt_items`
--

LOCK TABLES `goods_receipt_items` WRITE;
/*!40000 ALTER TABLE `goods_receipt_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `goods_receipt_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goods_receipts`
--

DROP TABLE IF EXISTS `goods_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods_receipts` (
  `grn_id` int NOT NULL AUTO_INCREMENT,
  `po_id` int DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `receipt_date` datetime DEFAULT NULL,
  `status` enum('pending','completed') DEFAULT 'pending',
  `notes` text,
  `is_cancelled` tinyint(1) NOT NULL DEFAULT '0',
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_reason` text,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `grn_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `SupplierInvoice` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `SupplierInvoiceDate` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`grn_id`),
  UNIQUE KEY `IX_goods_receipts_grn_number` (`grn_number`),
  KEY `po_id` (`po_id`),
  KEY `supplier_id` (`supplier_id`),
  CONSTRAINT `goods_receipts_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`po_id`),
  CONSTRAINT `goods_receipts_ibfk_2` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goods_receipts`
--

LOCK TABLES `goods_receipts` WRITE;
/*!40000 ALTER TABLE `goods_receipts` DISABLE KEYS */;
/*!40000 ALTER TABLE `goods_receipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_items`
--

DROP TABLE IF EXISTS `invoice_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoice_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `invoice_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `total` decimal(12,2) DEFAULT NULL,
  `tax_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `tax_percent` decimal(18,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  KEY `invoice_id` (`invoice_id`),
  KEY `product_id` (`product_id`),
  KEY `variant_id` (`variant_id`),
  CONSTRAINT `invoice_items_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`invoice_id`),
  CONSTRAINT `invoice_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
  CONSTRAINT `invoice_items_ibfk_3` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_items`
--

LOCK TABLES `invoice_items` WRITE;
/*!40000 ALTER TABLE `invoice_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoice_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `invoice_id` int NOT NULL AUTO_INCREMENT,
  `so_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `invoice_number` varchar(100) DEFAULT NULL,
  `invoice_date` datetime DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'Sent',
  `total_amount` decimal(12,2) DEFAULT NULL,
  `paid_amount` decimal(12,2) DEFAULT '0.00',
  `balance_amount` decimal(12,2) DEFAULT NULL,
  `is_cancelled` tinyint(1) NOT NULL DEFAULT '0',
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_reason` text,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`invoice_id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  KEY `so_id` (`so_id`),
  KEY `customer_id` (`customer_id`),
  KEY `idx_invoices_is_cancelled_customer` (`is_cancelled`,`customer_id`),
  KEY `idx_invoices_warehouse_id` (`warehouse_id`),
  CONSTRAINT `fk_invoices_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`),
  CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`so_id`) REFERENCES `sales_orders` (`so_id`),
  CONSTRAINT `invoices_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `location_movements`
--

DROP TABLE IF EXISTS `location_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `location_movements` (
  `movement_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `from_bin_id` int DEFAULT NULL,
  `to_bin_id` int DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `movement_date` datetime DEFAULT NULL,
  PRIMARY KEY (`movement_id`),
  KEY `product_id` (`product_id`),
  KEY `variant_id` (`variant_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `from_bin_id` (`from_bin_id`),
  KEY `to_bin_id` (`to_bin_id`),
  CONSTRAINT `location_movements_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
  CONSTRAINT `location_movements_ibfk_2` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`),
  CONSTRAINT `location_movements_ibfk_3` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`),
  CONSTRAINT `location_movements_ibfk_4` FOREIGN KEY (`from_bin_id`) REFERENCES `bins` (`bin_id`),
  CONSTRAINT `location_movements_ibfk_5` FOREIGN KEY (`to_bin_id`) REFERENCES `bins` (`bin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `location_movements`
--

LOCK TABLES `location_movements` WRITE;
/*!40000 ALTER TABLE `location_movements` DISABLE KEYS */;
/*!40000 ALTER TABLE `location_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `login_history`
--

DROP TABLE IF EXISTS `login_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_history` (
  `LoginHistoryId` int NOT NULL AUTO_INCREMENT,
  `UserId` int NOT NULL,
  `LoginTime` datetime DEFAULT CURRENT_TIMESTAMP,
  `DeviceInfo` varchar(255) DEFAULT NULL,
  `IpAddress` varchar(100) DEFAULT NULL,
  `LogoutTime` datetime DEFAULT NULL,
  `Browser` varchar(100) DEFAULT NULL,
  `OperatingSystem` varchar(100) DEFAULT NULL,
  `LogoutType` varchar(50) DEFAULT NULL,
  `IsCurrentSession` bit(1) NOT NULL DEFAULT b'0',
  PRIMARY KEY (`LoginHistoryId`),
  KEY `UserId` (`UserId`),
  CONSTRAINT `login_history_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `users` (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_history`
--

LOCK TABLES `login_history` WRITE;
/*!40000 ALTER TABLE `login_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `login_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `modules`
--

DROP TABLE IF EXISTS `modules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `modules` (
  `ModuleId` int NOT NULL AUTO_INCREMENT,
  `ModuleKey` varchar(100) NOT NULL,
  `ModuleName` varchar(100) NOT NULL,
  `Category` varchar(100) DEFAULT NULL,
  `Description` varchar(255) DEFAULT NULL,
  `DisplayOrder` int DEFAULT '0',
  `IsActive` bit(1) DEFAULT b'1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ModuleId`),
  UNIQUE KEY `ModuleKey` (`ModuleKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `modules`
--

LOCK TABLES `modules` WRITE;
/*!40000 ALTER TABLE `modules` DISABLE KEYS */;
INSERT INTO `modules` VALUES (1,'dashboard','Dashboard','Dashboard','Dashboard module',1,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(2,'products','Products','Masters','Manage products',2,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(3,'categories','Categories','Masters','Manage categories',3,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(4,'subCategories','Sub Categories','Masters','Manage sub categories',4,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(5,'brands','Brands','Masters','Manage brands',5,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(6,'units','Units','Masters','Manage units',6,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(7,'productAttributes','Product Attributes','Masters','Manage product attributes',7,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(8,'productVariants','Product Variants','Masters','Manage product variants',8,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(9,'stock','Stock','Inventory','Stock register',9,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(10,'stockMovements','Stock Movements','Inventory','Stock movement history',10,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(11,'stockLedger','Stock Ledger','Inventory','Stock ledger',11,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(12,'stockAdjustments','Stock Adjustments','Inventory','Stock adjustments',12,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(13,'stockAdjustmentItems','Stock Adjustment Items','Inventory','Stock adjustment items',13,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(14,'stockTransfers','Stock Transfers','Inventory','Stock transfers',14,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(15,'stockTransferItems','Stock Transfer Items','Inventory','Stock transfer items',15,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(16,'stockAudits','Stock Audits','Inventory','Stock audits',16,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(17,'stockAuditItems','Stock Audit Items','Inventory','Stock audit items',17,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(18,'goodsReceipts','Goods Receipts','Inventory','Goods receipt',18,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(19,'purchases','Purchases','Inventory','Purchase management',19,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(20,'sales','Sales','Inventory','Sales management',20,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(21,'inventoryAudit','Inventory Audit','Inventory','Inventory audit',21,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(22,'barcode','Barcode / QR','Inventory','Barcode management',22,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(23,'suppliers','Suppliers','Masters','Supplier management',23,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(24,'customers','Customers','Masters','Customer management',24,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(25,'customerPayments','Customer Payments','Billing','Customer payments',25,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(26,'supplierPayments','Supplier Payments','Billing','Supplier payments',26,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(27,'warehouses','Warehouses','Management','Warehouse management',27,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(28,'reports','Reports','Management','Reports',28,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(29,'notifications','Notifications','Management','Notifications',29,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(30,'accounting','Accounting','Management','Accounting',30,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(31,'returns','Returns & Exchanges','Returns','Returns management',31,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(32,'users','Users','Administration','User management',32,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(33,'roles','Roles','Administration','Role management',33,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(34,'auditLogs','Audit Logs','Administration','Audit logs',34,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(35,'systemSettings','System Settings','Administration','System settings',35,_binary '','2026-07-04 00:17:08','2026-07-04 00:17:08'),(36,'purchaseIndent','Purchase Indent','Inventory',NULL,36,_binary '','2026-08-14 20:26:29','2026-08-14 20:26:29'),(37,'purchaseReturns','Purchase Returns','Returns',NULL,37,_binary '','2026-08-14 20:26:52','2026-08-14 20:26:52'),(38,'salesReturns','Sales Returns','Returns',NULL,38,_binary '','2026-08-14 20:27:04','2026-08-14 20:27:04');
/*!40000 ALTER TABLE `modules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `message` text,
  `type` varchar(50) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `otps`
--

DROP TABLE IF EXISTS `otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `otps` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Email` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Code` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ExpiryTime` datetime(6) NOT NULL,
  `CreatedAt` datetime(6) NOT NULL DEFAULT '0001-01-01 00:00:00.000000',
  `IsUsed` tinyint(1) NOT NULL DEFAULT '0',
  `Purpose` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `UserId` int DEFAULT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_otps_UserId` (`UserId`),
  CONSTRAINT `FK_otps_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `users` (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `otps`
--

LOCK TABLES `otps` WRITE;
/*!40000 ALTER TABLE `otps` DISABLE KEYS */;
/*!40000 ALTER TABLE `otps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pendingusers`
--

DROP TABLE IF EXISTS `pendingusers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pendingusers` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(50) NOT NULL,
  `Email` varchar(256) NOT NULL,
  `PhoneNumber` varchar(10) NOT NULL,
  `PasswordHash` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Role` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `EmailVerificationToken` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `EmailVerificationTokenExpiry` datetime(6) NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pendingusers`
--

LOCK TABLES `pendingusers` WRITE;
/*!40000 ALTER TABLE `pendingusers` DISABLE KEYS */;
/*!40000 ALTER TABLE `pendingusers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_images`
--

DROP TABLE IF EXISTS `product_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_images` (
  `image_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`image_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_images_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_images`
--

LOCK TABLES `product_images` WRITE;
/*!40000 ALTER TABLE `product_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_variants`
--

DROP TABLE IF EXISTS `product_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_variants` (
  `variant_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `variant_name` varchar(255) DEFAULT NULL,
  `sku` varchar(100) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`variant_id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_variants_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_variants`
--

LOCK TABLES `product_variants` WRITE;
/*!40000 ALTER TABLE `product_variants` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_variants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `product_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `category_id` int DEFAULT NULL,
  `brand_id` int DEFAULT NULL,
  `unit_id` int DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `barcode` varchar(100) DEFAULT NULL,
  `description` text,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `reorder_level` int DEFAULT NULL,
  `stock` int DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `is_deleted` bit(1) DEFAULT b'0',
  `image_url` varchar(500) DEFAULT NULL,
  `sub_category_id` int DEFAULT NULL,
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`product_id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `category_id` (`category_id`),
  KEY `brand_id` (`brand_id`),
  KEY `unit_id` (`unit_id`),
  KEY `fk_products_subcategory` (`sub_category_id`),
  KEY `idx_products_is_archived` (`is_archived`),
  KEY `idx_products_is_deleted_archived` (`is_deleted`,`is_archived`),
  KEY `idx_products_supplier_id` (`supplier_id`),
  KEY `idx_products_warehouse_id` (`warehouse_id`),
  CONSTRAINT `fk_products_subcategory` FOREIGN KEY (`sub_category_id`) REFERENCES `sub_categories` (`sub_category_id`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`),
  CONSTRAINT `products_ibfk_2` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`brand_id`),
  CONSTRAINT `products_ibfk_3` FOREIGN KEY (`unit_id`) REFERENCES `units` (`unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (1,'OfficePro Productivity Suite – Business License','SW-LIC-OPS-001',1,1,1,8500.00,6200.00,'BAR-20261002-100137','Per-user perpetual license for documents, spreadsheets and presentations with lifetime updates for the major version.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',20,NULL,NULL,NULL,_binary '\0',NULL,1,0),(2,'ERP Core Module – Annual License','SW-LIC-ERP-002',1,1,1,125000.00,90000.00,'BAR-20261002-100274','Annual license for the core ERP module covering finance, inventory and procurement for up to 50 users.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',5,NULL,NULL,NULL,_binary '\0',NULL,2,0),(3,'Accounting & GST Suite – Single User','SW-LIC-ACC-003',1,1,1,14500.00,10200.00,'BAR-20261002-100411','Desktop accounting with GST filing support, invoicing and bank reconciliation.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',15,NULL,NULL,NULL,_binary '\0',NULL,2,0),(4,'CRM Cloud – Professional (per seat / month)','SW-SAAS-CRM-004',2,2,3,1800.00,1250.00,'BAR-20261002-100548','Cloud CRM with pipeline management, contact tracking, email sync and reporting.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',25,NULL,NULL,NULL,_binary '\0',NULL,3,0),(5,'TeamSpace Collaboration – Standard (per seat / month)','SW-SAAS-COL-005',2,2,3,650.00,430.00,'BAR-20261002-100685','Chat, video meetings, shared documents and project boards for distributed teams.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',40,NULL,NULL,NULL,_binary '\0',NULL,4,0),(6,'HelpDesk Cloud – Agent Plan (per agent / month)','SW-SAAS-HLP-006',2,2,3,1200.00,820.00,'BAR-20261002-100822','Ticketing, SLA tracking and a knowledge base for customer support teams.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',20,NULL,NULL,NULL,_binary '\0',NULL,4,0),(7,'Cloud VM – 4 vCPU / 16 GB (monthly)','SW-CLD-VM-007',3,2,5,6400.00,4800.00,'BAR-20261002-100959','General-purpose virtual machine with SSD storage and 99.9% uptime SLA.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',10,NULL,NULL,NULL,_binary '\0',NULL,5,0),(8,'Object Storage – 1 TB (monthly)','SW-CLD-STO-008',3,2,5,1900.00,1300.00,'BAR-20261002-101096','Scalable object storage with versioning and encryption at rest.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',15,NULL,NULL,NULL,_binary '\0',NULL,5,0),(9,'SSL Certificate – Wildcard (1 year)','SW-CLD-SSL-009',3,2,1,7200.00,4900.00,'BAR-20261002-101233','Wildcard SSL/TLS certificate for a domain and unlimited sub-domains.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',10,NULL,NULL,NULL,_binary '\0',NULL,6,0),(10,'Endpoint Protection – 50 Device Pack (1 year)','SW-SEC-EPP-010',4,3,1,32000.00,22500.00,'BAR-20261002-101370','Next-gen antivirus, device control and centralized management console for 50 endpoints.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',8,NULL,NULL,NULL,_binary '\0',NULL,7,0),(11,'Next-Gen Firewall Subscription (1 year)','SW-SEC-FWL-011',4,3,2,48000.00,34000.00,'BAR-20261002-101507','Intrusion prevention, web filtering and application control subscription for a firewall appliance.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',5,NULL,NULL,NULL,_binary '\0',NULL,8,0),(12,'Password Vault Enterprise – per user / year','SW-SEC-PWD-012',4,3,3,2400.00,1600.00,'BAR-20261002-101644','Team password manager with SSO, audit logs and role-based sharing.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',30,NULL,NULL,NULL,_binary '\0',NULL,7,0),(13,'DevStudio IDE – Team License','SW-DEV-IDE-013',5,4,1,9800.00,7000.00,'BAR-20261002-101781','Integrated development environment with debugger, profiler and Git integration.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',12,NULL,NULL,NULL,_binary '\0',NULL,9,0),(14,'CI/CD Pipeline Runner – Pro (monthly)','SW-DEV-CI-014',5,4,2,4200.00,2900.00,'BAR-20261002-101918','Hosted build and deployment pipelines with parallel jobs and artifact storage.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',10,NULL,NULL,NULL,_binary '\0',NULL,9,0),(15,'API Gateway & Monitoring – Growth (monthly)','SW-DEV-API-015',5,4,2,5600.00,3900.00,'BAR-20261002-102055','API management, rate limiting, analytics and uptime alerts.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',10,NULL,NULL,NULL,_binary '\0',NULL,10,0),(16,'Annual Maintenance Plan – Standard','SW-SVC-AMC-016',6,1,2,18000.00,11000.00,'BAR-20261002-102192','Bug fixes, minor upgrades and business-hours support for one licensed product.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',10,NULL,NULL,NULL,_binary '\0',NULL,11,0),(17,'Premium 24x7 Support Plan (1 year)','SW-SVC-SUP-017',6,1,2,42000.00,26000.00,'BAR-20261002-102329','Round-the-clock priority support with a four-hour response target.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',5,NULL,NULL,NULL,_binary '\0',NULL,11,0),(18,'Onboarding & Training Package – 2 Days','SW-SVC-TRN-018',6,1,4,25000.00,15000.00,'BAR-20261002-102466','Two-day instructor-led onboarding and administrator training for a customer team.','active','2026-10-02 09:00:00','2026-10-02 09:00:00',5,NULL,NULL,NULL,_binary '\0',NULL,12,0);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_indent_items`
--

DROP TABLE IF EXISTS `purchase_indent_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_indent_items` (
  `purchase_indent_item_id` int NOT NULL AUTO_INCREMENT,
  `purchase_indent_id` int NOT NULL,
  `product_id` int NOT NULL,
  `required_qty` decimal(18,2) NOT NULL,
  `unit_id` int NOT NULL,
  `available_stock` decimal(18,2) NOT NULL,
  `required_date` datetime(6) NOT NULL,
  `remarks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  PRIMARY KEY (`purchase_indent_item_id`),
  KEY `IX_purchase_indent_items_purchase_indent_id` (`purchase_indent_id`),
  CONSTRAINT `FK_purchase_indent_items_purchase_indents_purchase_indent_id` FOREIGN KEY (`purchase_indent_id`) REFERENCES `purchase_indents` (`purchase_indent_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_indent_items`
--

LOCK TABLES `purchase_indent_items` WRITE;
/*!40000 ALTER TABLE `purchase_indent_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_indent_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_indents`
--

DROP TABLE IF EXISTS `purchase_indents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_indents` (
  `purchase_indent_id` int NOT NULL AUTO_INCREMENT,
  `indent_number` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `indent_date` datetime(6) NOT NULL,
  `required_date` datetime(6) NOT NULL,
  `requested_by` int NOT NULL,
  `department_id` int NOT NULL,
  `supplier_id` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `priority` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `status` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `remarks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `total_items` int NOT NULL,
  `total_quantity` decimal(18,2) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`purchase_indent_id`),
  UNIQUE KEY `IX_purchase_indents_indent_number` (`indent_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_indents`
--

LOCK TABLES `purchase_indents` WRITE;
/*!40000 ALTER TABLE `purchase_indents` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_indents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_order_items`
--

DROP TABLE IF EXISTS `purchase_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `received_quantity` decimal(10,2) DEFAULT '0.00',
  `price` decimal(10,2) DEFAULT NULL,
  `total` decimal(12,2) DEFAULT NULL,
  `discount` decimal(65,30) DEFAULT NULL,
  `tax` decimal(65,30) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `po_id` (`po_id`),
  CONSTRAINT `purchase_order_items_ibfk_1` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`po_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_order_items`
--

LOCK TABLES `purchase_order_items` WRITE;
/*!40000 ALTER TABLE `purchase_order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `po_id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int DEFAULT NULL,
  `po_number` varchar(100) DEFAULT NULL,
  `order_date` date DEFAULT NULL,
  `expected_date` date DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_cancelled` tinyint(1) NOT NULL DEFAULT '0',
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_reason` text,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `receiving_status` varchar(50) NOT NULL DEFAULT 'pending',
  `payment_status` varchar(50) NOT NULL DEFAULT 'Unpaid',
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`po_id`),
  UNIQUE KEY `po_number` (`po_number`),
  KEY `supplier_id` (`supplier_id`),
  KEY `idx_po_is_cancelled_supplier` (`is_cancelled`,`supplier_id`),
  CONSTRAINT `purchase_orders_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_return_items`
--

DROP TABLE IF EXISTS `purchase_return_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_return_items` (
  `purchase_return_item_id` int NOT NULL AUTO_INCREMENT,
  `purchase_return_id` int NOT NULL,
  `product_id` int NOT NULL,
  `variant_id` int DEFAULT NULL,
  `received_quantity` decimal(18,3) NOT NULL,
  `return_quantity` decimal(18,3) NOT NULL,
  `price` decimal(18,2) NOT NULL,
  `total` decimal(18,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`purchase_return_item_id`),
  KEY `fk_purchase_return_items_return` (`purchase_return_id`),
  CONSTRAINT `fk_purchase_return_items_return` FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns` (`purchase_return_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_return_items`
--

LOCK TABLES `purchase_return_items` WRITE;
/*!40000 ALTER TABLE `purchase_return_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_return_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_return_items_backup_20260821`
--

DROP TABLE IF EXISTS `purchase_return_items_backup_20260821`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_return_items_backup_20260821` (
  `purchase_return_item_id` int NOT NULL DEFAULT '0',
  `purchase_return_id` int NOT NULL,
  `product_id` int NOT NULL,
  `variant_id` int DEFAULT NULL,
  `received_quantity` decimal(18,3) NOT NULL,
  `return_quantity` decimal(18,3) NOT NULL,
  `price` decimal(18,2) NOT NULL,
  `total` decimal(18,2) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_return_items_backup_20260821`
--

LOCK TABLES `purchase_return_items_backup_20260821` WRITE;
/*!40000 ALTER TABLE `purchase_return_items_backup_20260821` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_return_items_backup_20260821` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_returns`
--

DROP TABLE IF EXISTS `purchase_returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_returns` (
  `purchase_return_id` int NOT NULL AUTO_INCREMENT,
  `return_number` varchar(50) NOT NULL,
  `supplier_id` int NOT NULL,
  `grn_id` int NOT NULL,
  `return_date` date NOT NULL,
  `reason` text NOT NULL,
  `total_return_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `status` varchar(30) NOT NULL DEFAULT 'Draft',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`purchase_return_id`),
  UNIQUE KEY `return_number` (`return_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_returns`
--

LOCK TABLES `purchase_returns` WRITE;
/*!40000 ALTER TABLE `purchase_returns` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_returns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_returns_backup_20260821`
--

DROP TABLE IF EXISTS `purchase_returns_backup_20260821`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_returns_backup_20260821` (
  `purchase_return_id` int NOT NULL DEFAULT '0',
  `return_number` varchar(50) NOT NULL,
  `supplier_id` int NOT NULL,
  `grn_id` int NOT NULL,
  `return_date` date NOT NULL,
  `reason` text NOT NULL,
  `total_return_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `status` varchar(30) NOT NULL DEFAULT 'Draft',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_returns_backup_20260821`
--

LOCK TABLES `purchase_returns_backup_20260821` WRITE;
/*!40000 ALTER TABLE `purchase_returns_backup_20260821` DISABLE KEYS */;
/*!40000 ALTER TABLE `purchase_returns_backup_20260821` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `putaway_audits`
--

DROP TABLE IF EXISTS `putaway_audits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `putaway_audits` (
  `putaway_audit_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `variant_id` int DEFAULT NULL,
  `warehouse_id` int NOT NULL,
  `rack_id` int NOT NULL,
  `bin_id` int NOT NULL,
  `quantity` decimal(18,2) NOT NULL,
  `user_id` int DEFAULT NULL,
  `user_name` varchar(256) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`putaway_audit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `putaway_audits`
--

LOCK TABLES `putaway_audits` WRITE;
/*!40000 ALTER TABLE `putaway_audits` DISABLE KEYS */;
/*!40000 ALTER TABLE `putaway_audits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `racks`
--

DROP TABLE IF EXISTS `racks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `racks` (
  `rack_id` int NOT NULL AUTO_INCREMENT,
  `warehouse_id` int DEFAULT NULL,
  `zone_id` int DEFAULT NULL,
  `rack_code` varchar(50) DEFAULT NULL,
  `description` text,
  PRIMARY KEY (`rack_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `zone_id` (`zone_id`),
  CONSTRAINT `racks_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`),
  CONSTRAINT `racks_ibfk_2` FOREIGN KEY (`zone_id`) REFERENCES `warehouse_zones` (`zone_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `racks`
--

LOCK TABLES `racks` WRITE;
/*!40000 ALTER TABLE `racks` DISABLE KEYS */;
INSERT INTO `racks` VALUES (1,2,NULL,'RACK-A','');
/*!40000 ALTER TABLE `racks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `RefreshTokenId` int NOT NULL AUTO_INCREMENT,
  `UserId` int NOT NULL,
  `Token` varchar(500) NOT NULL,
  `ExpiresAt` datetime NOT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `RevokedAt` datetime DEFAULT NULL,
  `CreatedByIp` varchar(100) DEFAULT NULL,
  `DeviceName` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`RefreshTokenId`),
  KEY `IX_RefreshTokens_UserId` (`UserId`),
  KEY `IX_RefreshTokens_Token` (`Token`),
  CONSTRAINT `FK_RefreshTokens_Users` FOREIGN KEY (`UserId`) REFERENCES `users` (`Id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `PermissionId` int NOT NULL AUTO_INCREMENT,
  `RoleId` int NOT NULL,
  `ModuleId` int NOT NULL,
  `CanView` bit(1) DEFAULT b'0',
  `CanAdd` bit(1) DEFAULT b'0',
  `CanEdit` bit(1) DEFAULT b'0',
  `CanDelete` bit(1) DEFAULT b'0',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`PermissionId`),
  KEY `FK_RolePermissions_Roles` (`RoleId`),
  KEY `FK_RolePermissions_Modules` (`ModuleId`),
  CONSTRAINT `FK_RolePermissions_Modules` FOREIGN KEY (`ModuleId`) REFERENCES `modules` (`ModuleId`) ON DELETE CASCADE,
  CONSTRAINT `FK_RolePermissions_Roles` FOREIGN KEY (`RoleId`) REFERENCES `roles` (`role_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,3,30,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(3,5,30,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(4,7,30,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(5,2,30,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(6,3,34,_binary '',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-09 10:12:05'),(8,5,34,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(9,7,34,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(10,2,34,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(11,3,22,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(13,5,22,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(14,7,22,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(15,2,22,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-08-17 15:35:33'),(16,3,5,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(18,5,5,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(19,7,5,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(20,2,5,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-14 19:43:27'),(21,3,3,_binary '',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-09 10:12:05'),(23,5,3,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(24,7,3,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-27 15:15:30'),(25,2,3,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-08-25 16:58:07'),(26,3,25,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(28,5,25,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(29,7,25,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(30,2,25,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(31,3,24,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(33,5,24,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(34,7,24,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(35,2,24,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(36,3,1,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-27 14:51:27'),(38,5,1,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-07 09:58:46'),(39,7,1,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-21 17:32:35'),(40,2,1,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-21 13:26:48'),(41,3,18,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(43,5,18,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(44,7,18,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(45,2,18,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(46,3,21,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(48,5,21,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(49,7,21,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(50,2,21,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(51,3,29,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(53,5,29,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(54,7,29,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(55,2,29,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-08-25 16:58:07'),(56,3,7,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(58,5,7,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(59,7,7,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(60,2,7,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(61,3,2,_binary '',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-09 10:12:05'),(63,5,2,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-08-17 15:35:33'),(64,7,2,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 20:02:47'),(65,2,2,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-21 13:34:45'),(66,3,8,_binary '',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-09 10:12:05'),(68,5,8,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(69,7,8,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(70,2,8,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(71,3,19,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(73,5,19,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(74,7,19,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(75,2,19,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-23 12:35:45'),(76,3,28,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(78,5,28,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(79,7,28,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(80,2,28,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-06 14:51:51'),(81,3,31,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(83,5,31,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(84,7,31,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(85,2,31,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(86,3,33,_binary '',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-09 10:12:05'),(88,5,33,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(89,7,33,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(90,2,33,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(91,3,20,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(93,5,20,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(94,7,20,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(95,2,20,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(96,3,9,_binary '',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-09 10:12:05'),(98,5,9,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(99,7,9,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(100,2,9,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-06 10:31:44'),(101,3,13,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(103,5,13,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(104,7,13,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(105,2,13,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(106,3,12,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(108,5,12,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(109,7,12,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(110,2,12,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(111,3,17,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(113,5,17,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(114,7,17,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(115,2,17,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(116,3,16,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(118,5,16,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(119,7,16,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(120,2,16,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(121,3,11,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(123,5,11,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(124,7,11,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(125,2,11,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(126,3,10,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(128,5,10,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(129,7,10,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(130,2,10,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(131,3,15,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(133,5,15,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(134,7,15,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(135,2,15,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(136,3,14,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(138,5,14,_binary '',_binary '\0',_binary '\0',_binary '','2026-07-04 07:33:52','2026-08-25 16:59:04'),(139,7,14,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(140,2,14,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(141,3,4,_binary '',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-09 10:12:05'),(143,5,4,_binary '',_binary '\0',_binary '\0',_binary '','2026-07-04 07:33:52','2026-08-25 16:59:04'),(144,7,4,_binary '',_binary '\0',_binary '\0',_binary '','2026-07-04 07:33:52','2026-07-21 17:32:35'),(145,2,4,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-09 09:34:24'),(146,3,26,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(148,5,26,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(149,7,26,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(150,2,26,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(151,3,23,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(153,5,23,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(154,7,23,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(155,2,23,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-06 10:29:57'),(156,3,35,_binary '',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-09 10:12:05'),(158,5,35,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(159,7,35,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-27 15:15:49'),(160,2,35,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-05 23:04:30'),(161,3,6,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(163,5,6,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(164,7,6,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(165,2,6,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(166,3,32,_binary '',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-09 10:12:05'),(168,5,32,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(169,7,32,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(170,2,32,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-06 14:51:35'),(171,3,27,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(173,5,27,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(174,7,27,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-07-04 07:33:52','2026-07-04 07:33:52'),(175,2,27,_binary '',_binary '',_binary '',_binary '','2026-07-04 07:33:52','2026-07-04 07:35:37'),(176,2,36,_binary '',_binary '',_binary '',_binary '','2026-08-14 20:37:56','2026-08-17 11:47:06'),(177,2,37,_binary '',_binary '',_binary '',_binary '','2026-08-14 20:37:56','2026-08-17 11:47:06'),(178,2,38,_binary '',_binary '',_binary '',_binary '','2026-08-14 20:37:56','2026-08-17 11:47:06'),(179,3,36,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(180,3,37,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(181,3,38,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(182,5,36,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(183,5,37,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(184,5,38,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(185,7,36,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(186,7,37,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(187,7,38,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(188,18,1,_binary '',_binary '',_binary '',_binary '','2026-08-14 20:37:56','2026-08-20 17:45:30'),(189,18,2,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-20 17:48:16'),(190,18,3,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(191,18,4,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(192,18,5,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(193,18,6,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(194,18,7,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(195,18,8,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(196,18,9,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(197,18,10,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(198,18,11,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(199,18,12,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(200,18,13,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(201,18,14,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(202,18,15,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(203,18,16,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(204,18,17,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(205,18,18,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(206,18,19,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(207,18,20,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-20 17:48:16'),(208,18,21,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(209,18,22,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(210,18,23,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(211,18,24,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(212,18,25,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(213,18,26,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(214,18,27,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(215,18,28,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(216,18,29,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(217,18,30,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(218,18,31,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(219,18,32,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(220,18,33,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(221,18,34,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(222,18,35,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(223,18,36,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(224,18,37,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56'),(225,18,38,_binary '\0',_binary '\0',_binary '\0',_binary '\0','2026-08-14 20:37:56','2026-08-14 20:37:56');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions_backup`
--

DROP TABLE IF EXISTS `role_permissions_backup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions_backup` (
  `PermissionId` int NOT NULL DEFAULT '0',
  `role_id` int NOT NULL,
  `ModuleName` varchar(100) NOT NULL,
  `ModuleDescription` varchar(255) DEFAULT NULL,
  `CanView` tinyint(1) DEFAULT '0',
  `CanAdd` tinyint(1) DEFAULT '0',
  `CanEdit` tinyint(1) DEFAULT '0',
  `CanDelete` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions_backup`
--

LOCK TABLES `role_permissions_backup` WRITE;
/*!40000 ALTER TABLE `role_permissions_backup` DISABLE KEYS */;
/*!40000 ALTER TABLE `role_permissions_backup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `IsActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (2,'Admin','System Administrator','2026-06-24 07:52:04',1),(3,'WH Manager','Warehouse Manager manages warehouse operations, inventory, stock movement, receiving, storage, and dispatch to ensure efficient inventory control.','2026-06-26 03:42:31',1),(5,'manager','Manager oversees overall business operations, manages inventory, sales, purchases, payments, reports, and supervises staff to ensure smooth business operations.','2026-07-02 00:46:45',1),(7,'Assistant Manager','Assistant Manager oversees daily inventory operations, manages stock, purchases, sales, payments, and reports while ensuring smooth business operations and team coordination.','2026-07-02 06:07:05',0),(18,'Store Keeper','Manages the stock','2026-08-08 01:51:18',1);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_order_items`
--

DROP TABLE IF EXISTS `sales_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_order_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `so_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `delivered_quantity` decimal(10,2) DEFAULT '0.00',
  `price` decimal(10,2) DEFAULT NULL,
  `total` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `so_id` (`so_id`),
  KEY `product_id` (`product_id`),
  KEY `variant_id` (`variant_id`),
  CONSTRAINT `sales_order_items_ibfk_1` FOREIGN KEY (`so_id`) REFERENCES `sales_orders` (`so_id`),
  CONSTRAINT `sales_order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
  CONSTRAINT `sales_order_items_ibfk_3` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_order_items`
--

LOCK TABLES `sales_order_items` WRITE;
/*!40000 ALTER TABLE `sales_order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_orders`
--

DROP TABLE IF EXISTS `sales_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_orders` (
  `so_id` int NOT NULL AUTO_INCREMENT,
  `customer_id` int DEFAULT NULL,
  `so_number` varchar(100) DEFAULT NULL,
  `order_date` date DEFAULT NULL,
  `status` enum('draft','confirmed','shipped','delivered','cancelled') DEFAULT 'draft',
  `total_amount` decimal(12,2) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`so_id`),
  UNIQUE KEY `so_number` (`so_number`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `sales_orders_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_orders`
--

LOCK TABLES `sales_orders` WRITE;
/*!40000 ALTER TABLE `sales_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_return_items`
--

DROP TABLE IF EXISTS `sales_return_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_return_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sales_return_id` int NOT NULL,
  `product_id` int NOT NULL,
  `variant_id` int DEFAULT NULL,
  `invoiced_quantity` decimal(18,3) NOT NULL,
  `return_quantity` decimal(18,3) NOT NULL,
  `price` decimal(18,2) NOT NULL,
  `tax` decimal(18,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `discount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `total` decimal(18,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_SalesReturnItems_SalesReturns` (`sales_return_id`),
  CONSTRAINT `FK_SalesReturnItems_SalesReturns` FOREIGN KEY (`sales_return_id`) REFERENCES `sales_returns` (`return_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_return_items`
--

LOCK TABLES `sales_return_items` WRITE;
/*!40000 ALTER TABLE `sales_return_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_return_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_return_items_backup`
--

DROP TABLE IF EXISTS `sales_return_items_backup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_return_items_backup` (
  `id` int NOT NULL DEFAULT '0',
  `return_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_return_items_backup`
--

LOCK TABLES `sales_return_items_backup` WRITE;
/*!40000 ALTER TABLE `sales_return_items_backup` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_return_items_backup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_return_items_backup_20260821`
--

DROP TABLE IF EXISTS `sales_return_items_backup_20260821`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_return_items_backup_20260821` (
  `SalesReturnItemId` int NOT NULL DEFAULT '0',
  `SalesReturnId` int NOT NULL,
  `ProductId` int NOT NULL,
  `VariantId` int DEFAULT NULL,
  `InvoicedQuantity` decimal(18,3) NOT NULL,
  `ReturnQuantity` decimal(18,3) NOT NULL,
  `Price` decimal(18,2) NOT NULL,
  `Total` decimal(18,2) NOT NULL DEFAULT '0.00',
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_return_items_backup_20260821`
--

LOCK TABLES `sales_return_items_backup_20260821` WRITE;
/*!40000 ALTER TABLE `sales_return_items_backup_20260821` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_return_items_backup_20260821` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_returns`
--

DROP TABLE IF EXISTS `sales_returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_returns` (
  `return_id` int NOT NULL AUTO_INCREMENT,
  `return_number` varchar(50) NOT NULL,
  `customer_id` int NOT NULL,
  `warehouse_id` int DEFAULT NULL,
  `invoice_id` int NOT NULL,
  `return_date` date NOT NULL,
  `reason` text NOT NULL,
  `rejection_reason` text,
  `approved_by` varchar(128) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `refund_method` varchar(64) DEFAULT NULL,
  `refund_reference` varchar(128) DEFAULT NULL,
  `refund_date` datetime DEFAULT NULL,
  `notes` text,
  `total_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `grand_total` decimal(18,2) NOT NULL DEFAULT '0.00',
  `refund_amount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `status` varchar(30) NOT NULL DEFAULT 'Draft',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`return_id`),
  UNIQUE KEY `ReturnNumber` (`return_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_returns`
--

LOCK TABLES `sales_returns` WRITE;
/*!40000 ALTER TABLE `sales_returns` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_returns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_returns_backup`
--

DROP TABLE IF EXISTS `sales_returns_backup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_returns_backup` (
  `return_id` int NOT NULL DEFAULT '0',
  `invoice_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `return_date` datetime DEFAULT NULL,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `reason` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_returns_backup`
--

LOCK TABLES `sales_returns_backup` WRITE;
/*!40000 ALTER TABLE `sales_returns_backup` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_returns_backup` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_returns_backup_20260821`
--

DROP TABLE IF EXISTS `sales_returns_backup_20260821`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_returns_backup_20260821` (
  `SalesReturnId` int NOT NULL DEFAULT '0',
  `ReturnNumber` varchar(50) NOT NULL,
  `CustomerId` int NOT NULL,
  `InvoiceId` int NOT NULL,
  `ReturnDate` date NOT NULL,
  `Reason` text NOT NULL,
  `TotalReturnAmount` decimal(18,2) NOT NULL DEFAULT '0.00',
  `Status` varchar(30) NOT NULL DEFAULT 'Draft',
  `CreatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_returns_backup_20260821`
--

LOCK TABLES `sales_returns_backup_20260821` WRITE;
/*!40000 ALTER TABLE `sales_returns_backup_20260821` DISABLE KEYS */;
/*!40000 ALTER TABLE `sales_returns_backup_20260821` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `SettingId` int NOT NULL AUTO_INCREMENT,
  `CompanyName` varchar(150) DEFAULT NULL,
  `CompanyLogo` varchar(255) DEFAULT NULL,
  `EmailAddress` varchar(150) DEFAULT NULL,
  `PhoneNumber` varchar(20) DEFAULT NULL,
  `Address` text,
  `LowStockAlertLimit` int DEFAULT '10',
  `DefaultUnitType` varchar(50) DEFAULT 'Pieces',
  `BarcodeManagement` tinyint(1) DEFAULT '1',
  `AutoStockUpdate` tinyint(1) DEFAULT '1',
  `LowStockAlerts` tinyint(1) DEFAULT '0',
  `OrderNotifications` tinyint(1) DEFAULT '0',
  `SupplierPaymentReminder` tinyint(1) DEFAULT '0',
  `TwoStepVerification` tinyint(1) DEFAULT '0',
  `ThemeMode` varchar(50) DEFAULT 'Light',
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `Language` varchar(50) DEFAULT 'English',
  `CollapseSidebar` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`SettingId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock`
--

DROP TABLE IF EXISTS `stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock` (
  `stock_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT '0.00',
  `reserved_quantity` decimal(10,2) DEFAULT '0.00',
  `available_quantity` decimal(10,2) GENERATED ALWAYS AS ((`quantity` - `reserved_quantity`)) STORED,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`stock_id`),
  UNIQUE KEY `product_id` (`product_id`,`variant_id`,`warehouse_id`),
  KEY `variant_id` (`variant_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `idx_stock_product_quantity` (`product_id`,`quantity`),
  CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
  CONSTRAINT `stock_ibfk_2` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`),
  CONSTRAINT `stock_ibfk_3` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock`
--

LOCK TABLES `stock` WRITE;
/*!40000 ALTER TABLE `stock` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_adjustment_items`
--

DROP TABLE IF EXISTS `stock_adjustment_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_adjustment_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `adjustment_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `adjustment_id` (`adjustment_id`),
  KEY `product_id` (`product_id`),
  KEY `variant_id` (`variant_id`),
  CONSTRAINT `stock_adjustment_items_ibfk_1` FOREIGN KEY (`adjustment_id`) REFERENCES `stock_adjustments` (`adjustment_id`),
  CONSTRAINT `stock_adjustment_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
  CONSTRAINT `stock_adjustment_items_ibfk_3` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_adjustment_items`
--

LOCK TABLES `stock_adjustment_items` WRITE;
/*!40000 ALTER TABLE `stock_adjustment_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_adjustment_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_adjustments`
--

DROP TABLE IF EXISTS `stock_adjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_adjustments` (
  `adjustment_id` int NOT NULL AUTO_INCREMENT,
  `warehouse_id` int DEFAULT NULL,
  `adjustment_type` enum('increase','decrease') DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`adjustment_id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `stock_adjustments_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_adjustments`
--

LOCK TABLES `stock_adjustments` WRITE;
/*!40000 ALTER TABLE `stock_adjustments` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_adjustments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_audit_items`
--

DROP TABLE IF EXISTS `stock_audit_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_audit_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `audit_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `bin_id` int DEFAULT NULL,
  `system_quantity` decimal(10,2) DEFAULT NULL,
  `physical_quantity` decimal(10,2) DEFAULT NULL,
  `difference` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_id` (`audit_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `stock_audit_items_ibfk_1` FOREIGN KEY (`audit_id`) REFERENCES `stock_audits` (`audit_id`),
  CONSTRAINT `stock_audit_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_audit_items`
--

LOCK TABLES `stock_audit_items` WRITE;
/*!40000 ALTER TABLE `stock_audit_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_audit_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_audits`
--

DROP TABLE IF EXISTS `stock_audits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_audits` (
  `audit_id` int NOT NULL AUTO_INCREMENT,
  `warehouse_id` int DEFAULT NULL,
  `audit_date` date DEFAULT NULL,
  `audit_type` enum('Cycle Count','Full Audit','Spot Check') DEFAULT NULL,
  `status` enum('Draft','Pending','Approved','Posted','Cancelled') DEFAULT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `approved_by` varchar(255) DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`audit_id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `stock_audits_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_audits`
--

LOCK TABLES `stock_audits` WRITE;
/*!40000 ALTER TABLE `stock_audits` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_audits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_ledger`
--

DROP TABLE IF EXISTS `stock_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_ledger` (
  `ledger_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `opening_qty` decimal(10,2) DEFAULT NULL,
  `change_qty` decimal(10,2) DEFAULT NULL,
  `closing_qty` decimal(10,2) DEFAULT NULL,
  `transaction_type` varchar(50) DEFAULT NULL,
  `transaction_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_cancelled` tinyint(1) NOT NULL DEFAULT '0',
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_reason` varchar(255) DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`ledger_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_ledger`
--

LOCK TABLES `stock_ledger` WRITE;
/*!40000 ALTER TABLE `stock_ledger` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_ledger` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_movements`
--

DROP TABLE IF EXISTS `stock_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_movements` (
  `movement_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `warehouse_id` int DEFAULT NULL,
  `movement_type` varchar(50) DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `reference_id` int DEFAULT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_cancelled` tinyint(1) NOT NULL DEFAULT '0',
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_reason` varchar(255) DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`movement_id`),
  KEY `product_id` (`product_id`),
  KEY `variant_id` (`variant_id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
  CONSTRAINT `stock_movements_ibfk_2` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`),
  CONSTRAINT `stock_movements_ibfk_3` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_movements`
--

LOCK TABLES `stock_movements` WRITE;
/*!40000 ALTER TABLE `stock_movements` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_transfer_items`
--

DROP TABLE IF EXISTS `stock_transfer_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfer_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transfer_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `transfer_id` (`transfer_id`),
  KEY `product_id` (`product_id`),
  KEY `variant_id` (`variant_id`),
  CONSTRAINT `stock_transfer_items_ibfk_1` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers` (`transfer_id`),
  CONSTRAINT `stock_transfer_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
  CONSTRAINT `stock_transfer_items_ibfk_3` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_transfer_items`
--

LOCK TABLES `stock_transfer_items` WRITE;
/*!40000 ALTER TABLE `stock_transfer_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_transfer_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_transfers`
--

DROP TABLE IF EXISTS `stock_transfers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_transfers` (
  `transfer_id` int NOT NULL AUTO_INCREMENT,
  `from_warehouse_id` int DEFAULT NULL,
  `to_warehouse_id` int DEFAULT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `status` enum('pending','completed','cancelled') DEFAULT 'pending',
  PRIMARY KEY (`transfer_id`),
  KEY `from_warehouse_id` (`from_warehouse_id`),
  KEY `to_warehouse_id` (`to_warehouse_id`),
  CONSTRAINT `stock_transfers_ibfk_1` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses` (`warehouse_id`),
  CONSTRAINT `stock_transfers_ibfk_2` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_transfers`
--

LOCK TABLES `stock_transfers` WRITE;
/*!40000 ALTER TABLE `stock_transfers` DISABLE KEYS */;
/*!40000 ALTER TABLE `stock_transfers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sub_categories`
--

DROP TABLE IF EXISTS `sub_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sub_categories` (
  `sub_category_id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text,
  `status` varchar(50) DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`sub_category_id`),
  KEY `fk_sub_category_category` (`category_id`),
  CONSTRAINT `fk_sub_category_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sub_categories`
--

LOCK TABLES `sub_categories` WRITE;
/*!40000 ALTER TABLE `sub_categories` DISABLE KEYS */;
INSERT INTO `sub_categories` VALUES (1,1,'Productivity Suites','',NULL,'2026-10-02 09:00:00',0),(2,1,'Business Applications','',NULL,'2026-10-02 09:00:00',0),(3,2,'CRM & Sales','',NULL,'2026-10-02 09:00:00',0),(4,2,'Collaboration','',NULL,'2026-10-02 09:00:00',0),(5,3,'Compute & Storage','',NULL,'2026-10-02 09:00:00',0),(6,3,'Domains & SSL','',NULL,'2026-10-02 09:00:00',0),(7,4,'Endpoint Security','',NULL,'2026-10-02 09:00:00',0),(8,4,'Network Security','',NULL,'2026-10-02 09:00:00',0),(9,5,'IDEs & DevOps','',NULL,'2026-10-02 09:00:00',0),(10,5,'API & Monitoring','',NULL,'2026-10-02 09:00:00',0),(11,6,'Maintenance Plans','',NULL,'2026-10-02 09:00:00',0),(12,6,'Training & Onboarding','',NULL,'2026-10-02 09:00:00',0);
/*!40000 ALTER TABLE `sub_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_addresses`
--

DROP TABLE IF EXISTS `supplier_addresses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_addresses` (
  `address_id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int DEFAULT NULL,
  `address_type` enum('billing','shipping','office') DEFAULT 'office',
  `address_line` text,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `pincode` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`address_id`),
  KEY `supplier_id` (`supplier_id`),
  CONSTRAINT `supplier_addresses_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_addresses`
--

LOCK TABLES `supplier_addresses` WRITE;
/*!40000 ALTER TABLE `supplier_addresses` DISABLE KEYS */;
/*!40000 ALTER TABLE `supplier_addresses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_bank_details`
--

DROP TABLE IF EXISTS `supplier_bank_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_bank_details` (
  `bank_id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int DEFAULT NULL,
  `account_name` varchar(150) DEFAULT NULL,
  `account_number` varchar(50) DEFAULT NULL,
  `bank_name` varchar(150) DEFAULT NULL,
  `ifsc_code` varchar(20) DEFAULT NULL,
  `branch` varchar(100) DEFAULT NULL,
  `bank_state` varchar(100) DEFAULT NULL,
  `bank_city` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`bank_id`),
  KEY `supplier_id` (`supplier_id`),
  CONSTRAINT `supplier_bank_details_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_bank_details`
--

LOCK TABLES `supplier_bank_details` WRITE;
/*!40000 ALTER TABLE `supplier_bank_details` DISABLE KEYS */;
/*!40000 ALTER TABLE `supplier_bank_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_contacts`
--

DROP TABLE IF EXISTS `supplier_contacts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_contacts` (
  `contact_id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int DEFAULT NULL,
  `name` varchar(150) DEFAULT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT '0',
  `department` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`contact_id`),
  KEY `supplier_id` (`supplier_id`),
  CONSTRAINT `supplier_contacts_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_contacts`
--

LOCK TABLES `supplier_contacts` WRITE;
/*!40000 ALTER TABLE `supplier_contacts` DISABLE KEYS */;
/*!40000 ALTER TABLE `supplier_contacts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_documents`
--

DROP TABLE IF EXISTS `supplier_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_documents` (
  `document_id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int DEFAULT NULL,
  `display_name` varchar(150) DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `document_type` varchar(50) DEFAULT NULL,
  `original_file_name` varchar(255) DEFAULT NULL,
  `stored_file_name` varchar(255) DEFAULT NULL,
  `content_type` varchar(100) DEFAULT NULL,
  `file_size_bytes` bigint DEFAULT NULL,
  `status` varchar(50) DEFAULT 'uploaded',
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_temporary` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`document_id`),
  KEY `supplier_id` (`supplier_id`),
  KEY `idx_supplier_documents_supplier` (`supplier_id`),
  CONSTRAINT `supplier_documents_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_documents`
--

LOCK TABLES `supplier_documents` WRITE;
/*!40000 ALTER TABLE `supplier_documents` DISABLE KEYS */;
/*!40000 ALTER TABLE `supplier_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_payment_terms`
--

DROP TABLE IF EXISTS `supplier_payment_terms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_payment_terms` (
  `term_id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int DEFAULT NULL,
  `credit_days` int DEFAULT '0',
  `credit_limit` decimal(12,2) DEFAULT '0.00',
  `payment_method` varchar(50) DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`term_id`),
  KEY `supplier_id` (`supplier_id`),
  CONSTRAINT `supplier_payment_terms_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_payment_terms`
--

LOCK TABLES `supplier_payment_terms` WRITE;
/*!40000 ALTER TABLE `supplier_payment_terms` DISABLE KEYS */;
/*!40000 ALTER TABLE `supplier_payment_terms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_payments`
--

DROP TABLE IF EXISTS `supplier_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_payments` (
  `payment_id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int DEFAULT NULL,
  `po_id` int DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `payment_date` datetime DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `notes` text,
  `is_cancelled` tinyint(1) NOT NULL DEFAULT '0',
  `cancelled_at` datetime DEFAULT NULL,
  `cancellation_reason` text,
  PRIMARY KEY (`payment_id`),
  KEY `supplier_id` (`supplier_id`),
  KEY `po_id` (`po_id`),
  CONSTRAINT `supplier_payments_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`),
  CONSTRAINT `supplier_payments_ibfk_2` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`po_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_payments`
--

LOCK TABLES `supplier_payments` WRITE;
/*!40000 ALTER TABLE `supplier_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `supplier_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_performance`
--

DROP TABLE IF EXISTS `supplier_performance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_performance` (
  `performance_id` int NOT NULL AUTO_INCREMENT,
  `supplier_id` int DEFAULT NULL,
  `total_orders` int DEFAULT '0',
  `on_time_deliveries` int DEFAULT '0',
  `delayed_deliveries` int DEFAULT '0',
  `rating` decimal(3,2) DEFAULT NULL,
  `last_updated` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`performance_id`),
  KEY `supplier_id` (`supplier_id`),
  CONSTRAINT `supplier_performance_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_performance`
--

LOCK TABLES `supplier_performance` WRITE;
/*!40000 ALTER TABLE `supplier_performance` DISABLE KEYS */;
/*!40000 ALTER TABLE `supplier_performance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `supplier_id` int NOT NULL AUTO_INCREMENT,
  `supplier_code` varchar(50) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `gst_number` varchar(50) DEFAULT NULL,
  `pan_number` varchar(20) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `website` varchar(150) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `category` varchar(100) DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`supplier_id`),
  UNIQUE KEY `supplier_code` (`supplier_code`),
  KEY `idx_suppliers_is_deleted` (`is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_setting_rules`
--

DROP TABLE IF EXISTS `system_setting_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_setting_rules` (
  `rule_id` int NOT NULL AUTO_INCREMENT,
  `section_id` int NOT NULL,
  `rule_key` varchar(150) NOT NULL,
  `rule_name` varchar(200) NOT NULL,
  `rule_description` varchar(500) DEFAULT NULL,
  `rule_type` varchar(50) NOT NULL,
  `rule_value` varchar(500) DEFAULT NULL,
  `default_value` varchar(500) DEFAULT NULL,
  `is_enabled` tinyint(1) DEFAULT '1',
  `display_order` int NOT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rule_id`),
  UNIQUE KEY `rule_key` (`rule_key`),
  KEY `section_id` (`section_id`),
  CONSTRAINT `system_setting_rules_ibfk_1` FOREIGN KEY (`section_id`) REFERENCES `system_setting_sections` (`section_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_setting_rules`
--

LOCK TABLES `system_setting_rules` WRITE;
/*!40000 ALTER TABLE `system_setting_rules` DISABLE KEYS */;
INSERT INTO `system_setting_rules` VALUES (1,1,'auto_generate_product_code','Auto Generate Product Code','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',0,1,'2026-07-27 15:03:02'),(2,1,'product_code_prefix','Product Code Prefix','Enter the default text value used for this rule.','text','PRDCT-','PRD-',1,2,'2026-07-27 15:03:02'),(3,1,'sku_prefix','SKU Prefix','Enter the default text value used for this rule.','text','NAD-','SKU-',1,3,'2026-07-27 15:03:02'),(4,1,'allow_product_variants','Allow Product Variants','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',1,4,'2026-07-27 15:03:02'),(5,1,'brand_required','Brand Required','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',0,5,'2026-07-27 15:03:02'),(6,1,'category_required','Category Required','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',0,6,'2026-07-27 15:03:02'),(7,1,'subcategory_required','SubCategory Required','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,7,'2026-07-27 15:03:02'),(8,1,'attribute_required_for_variants','Attribute Required For Variants','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',1,8,'2026-07-27 15:03:02'),(9,1,'hsn_code_required','HSN Code Required','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,9,'2026-07-27 15:03:02'),(10,1,'product_image_required','Product Image Required','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,10,'2026-07-27 15:03:02'),(11,1,'duplicate_product_name_allowed','Duplicate Product Name Allowed','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,11,'2026-07-27 15:03:02'),(12,2,'purchase_order_prefix','Purchase Order Prefix','Enter the default text value used for this rule.','text','PO-','PO-',1,1,'2026-08-10 12:46:07'),(13,2,'auto_generate_po_number','Auto Generate PO Number','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',0,2,'2026-08-10 12:46:07'),(14,2,'default_purchase_status','Default Purchase Status','Choose the default option used by this module.','dropdown','Pending','Pending',1,3,'2026-08-10 12:46:07'),(15,2,'purchase_approval_required','Purchase Approval Required','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',0,4,'2026-08-10 12:46:07'),(16,2,'supplier_approval_required','Supplier Approval Required','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,5,'2026-08-10 12:46:07'),(17,2,'goods_receipt_approval_required','Goods Receipt Approval Required','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',0,6,'2026-08-10 12:46:07'),(18,2,'allow_partial_goods_receipt','Allow Partial Goods Receipt','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',0,7,'2026-08-10 12:46:07'),(19,2,'allow_purchase_without_supplier','Allow Purchase Without Supplier','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,8,'2026-08-10 12:46:07'),(20,2,'allow_purchase_price_override','Allow Purchase Price Override','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',0,9,'2026-08-10 12:46:07'),(21,2,'require_attachment_for_purchase','Require Attachment For Purchase','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,10,'2026-08-10 12:46:07'),(22,3,'invoice_prefix','Invoice Prefix','Enter the default text value used for this rule.','text','INV-','INV-',1,1,'2026-07-16 14:30:36'),(23,3,'auto_generate_invoice_number','Auto Generate Invoice Number','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',1,2,'2026-07-16 14:30:36'),(24,3,'default_sales_status','Default Sales Status','Choose the default option used by this module.','dropdown','Pending','Pending',1,3,'2026-07-16 14:30:36'),(25,3,'default_payment_status','Default Payment Status','Choose the default option used by this module.','dropdown','Unpaid','Unpaid',1,4,'2026-07-16 14:30:36'),(26,3,'default_payment_terms','Default Payment Terms','Enter the default text value used for this rule.','text','Immediate','Immediate',1,5,'2026-07-16 14:30:36'),(27,3,'require_customer_for_sale','Require Customer For Sale','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',1,6,'2026-07-16 14:30:36'),(28,3,'allow_partial_payment','Allow Partial Payment','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',1,7,'2026-07-16 14:30:36'),(29,3,'allow_sales_without_stock','Allow Sales Without Stock','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',1,8,'2026-07-16 14:30:36'),(30,3,'discount_limit_percentage','Discount Limit Percentage','Enter the numeric value used for this rule.','number','10','10',1,9,'2026-07-16 14:30:36'),(31,3,'require_approval_for_high_discount','Require Approval For High Discount','Turn this rule on or off for the IMS workflow.','toggle',NULL,'true',1,10,'2026-07-16 14:30:36'),(32,4,'allow_sales_return','Allow Sales Return','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,1,'2026-07-14 20:00:50'),(33,4,'sales_return_days','Sales Return Days','Enter the numeric value used for this rule.','number','7','7',0,2,'2026-07-14 20:00:50'),(34,4,'return_approval_required','Return Approval Required','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,3,'2026-07-14 20:00:50'),(35,4,'refund_approval_required','Refund Approval Required','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,4,'2026-07-14 20:00:50'),(36,4,'auto_restock_returned_items','Auto Restock Returned Items','Turn this rule on or off for the IMS workflow.','toggle','false','false',0,5,'2026-07-14 20:00:50'),(37,4,'require_return_reason','Require Return Reason','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,6,'2026-07-14 20:00:50'),(38,4,'allow_partial_return','Allow Partial Return','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,7,'2026-07-14 20:00:50'),(39,4,'return_number_prefix','Return Number Prefix','Enter the default text value used for this rule.','text','RET-','RET-',0,8,'2026-07-14 20:00:50'),(40,6,'gst_enabled','GST Enabled','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,1,'2026-07-14 20:00:50'),(41,6,'default_gst_percentage','Default GST Percentage','Enter the numeric value used for this rule.','number','18','18',0,2,'2026-07-14 20:00:50'),(42,6,'cgst_percentage','CGST Percentage','Enter the numeric value used for this rule.','number','9','9',0,3,'2026-07-14 20:00:50'),(43,6,'sgst_percentage','SGST Percentage','Enter the numeric value used for this rule.','number','9','9',0,4,'2026-07-14 20:00:50'),(44,6,'igst_percentage','IGST Percentage','Enter the numeric value used for this rule.','number','18','18',0,5,'2026-07-14 20:00:50'),(45,6,'tax_inclusive_pricing','Tax Inclusive Pricing','Turn this rule on or off for the IMS workflow.','toggle','false','false',0,6,'2026-07-14 20:00:50'),(46,6,'show_tax_on_invoice','Show Tax On Invoice','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,7,'2026-07-14 20:00:50'),(47,6,'round_off_invoice_amount','Round Off Invoice Amount','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,8,'2026-07-14 20:00:50'),(48,6,'decimal_places_for_amount','Decimal Places For Amount','Enter the numeric value used for this rule.','number','2','2',0,9,'2026-07-14 20:00:50'),(49,7,'allow_negative_stock','Allow Negative Stock','Turn this rule on or off for the IMS workflow.','toggle','false','false',0,1,'2026-07-14 20:00:51'),(50,7,'stock_adjustment_approval_required','Stock Adjustment Approval Required','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,2,'2026-07-14 20:00:51'),(51,7,'stock_transfer_approval_required','Stock Transfer Approval Required','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,3,'2026-07-14 20:00:51'),(52,7,'stock_audit_approval_required','Stock Audit Approval Required','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,4,'2026-07-14 20:00:51'),(53,7,'batch_number_required','Batch Number Required','Turn this rule on or off for the IMS workflow.','toggle','false','false',0,5,'2026-07-14 20:00:51'),(54,7,'expiry_tracking_enabled','Expiry Tracking Enabled','Turn this rule on or off for the IMS workflow.','toggle','false','false',0,6,'2026-07-14 20:00:51'),(55,7,'damage_stock_tracking_enabled','Damage Stock Tracking Enabled','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,7,'2026-07-14 20:00:51'),(56,7,'require_reason_for_stock_adjustment','Require Reason For Stock Adjustment','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,8,'2026-07-14 20:00:51'),(57,7,'allow_backdated_stock_entry','Allow Backdated Stock Entry','Turn this rule on or off for the IMS workflow.','toggle','false','false',0,9,'2026-07-14 20:00:51'),(58,7,'stock_movement_lock_after_days','Stock Movement Lock After Days','Enter the numeric value used for this rule.','number','7','7',0,10,'2026-07-14 20:00:51'),(59,8,'warehouse_required_for_stock','Warehouse Required For Stock','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,1,'2026-07-14 20:00:53'),(60,8,'bin_required_for_stock','Bin Required For Stock','Turn this rule on or off for the IMS workflow.','toggle','false','false',0,2,'2026-07-14 20:00:53'),(61,8,'rack_required_for_stock','Rack Required For Stock','Turn this rule on or off for the IMS workflow.','toggle','false','false',0,3,'2026-07-14 20:00:53'),(62,8,'auto_assign_bin','Auto Assign Bin','Turn this rule on or off for the IMS workflow.','toggle','false','false',0,4,'2026-07-14 20:00:53'),(63,8,'auto_putaway_enabled','Auto Putaway Enabled','Turn this rule on or off for the IMS workflow.','toggle','false','false',0,5,'2026-07-14 20:00:53'),(64,8,'allow_inter_warehouse_transfer','Allow Inter-Warehouse Transfer','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,6,'2026-07-14 20:00:53'),(65,8,'require_approval_for_warehouse_transfer','Require Approval For Warehouse Transfer','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,7,'2026-07-14 20:00:53'),(66,8,'allow_stock_in_inactive_warehouse','Allow Stock In Inactive Warehouse','Turn this rule on or off for the IMS workflow.','toggle','false','false',0,8,'2026-07-14 20:00:53'),(67,9,'enable_audit_logs','Enable Audit Logs','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,1,'2026-07-14 20:00:54'),(68,9,'track_user_login','Track User Login','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,2,'2026-07-14 20:00:54'),(69,9,'track_product_changes','Track Product Changes','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,3,'2026-07-14 20:00:54'),(70,9,'track_stock_changes','Track Stock Changes','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,4,'2026-07-14 20:00:54'),(71,9,'track_purchase_changes','Track Purchase Changes','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,5,'2026-07-14 20:00:54'),(72,9,'track_sales_changes','Track Sales Changes','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,6,'2026-07-14 20:00:54'),(73,9,'track_payment_changes','Track Payment Changes','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,7,'2026-07-14 20:00:54'),(74,9,'track_settings_changes','Track Settings Changes','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,8,'2026-07-14 20:00:54'),(75,9,'log_retention_days','Log Retention Days','Enter the numeric value used for this rule.','number','180','180',0,9,'2026-07-14 20:00:54'),(76,9,'allow_export_logs','Allow Export Logs','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,10,'2026-07-14 20:00:54'),(77,10,'default_report_date_range','Default Report Date Range','Choose the default option used by this module.','dropdown','This Month','This Month',0,1,'2026-07-14 20:00:55'),(78,10,'default_export_format','Default Export Format','Choose the default option used by this module.','dropdown','Excel','Excel',0,2,'2026-07-14 20:00:55'),(79,10,'enable_pdf_export','Enable PDF Export','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,3,'2026-07-14 20:00:55'),(80,10,'enable_excel_export','Enable Excel Export','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,4,'2026-07-14 20:00:55'),(81,10,'show_company_details_on_reports','Show Company Details On Reports','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,5,'2026-07-14 20:00:55'),(82,10,'show_tax_details_on_reports','Show Tax Details On Reports','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,6,'2026-07-14 20:00:55'),(83,10,'report_decimal_places','Report Decimal Places','Enter the numeric value used for this rule.','number','2','2',0,7,'2026-07-14 20:00:55'),(84,10,'allow_report_download','Allow Report Download','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,8,'2026-07-14 20:00:55'),(85,11,'session_timeout_minutes','Session Timeout Minutes','Enter the numeric value used for this rule.','number','30','30',0,1,'2026-07-14 20:00:56'),(86,11,'max_login_attempts','Max Login Attempts','Enter the numeric value used for this rule.','number','5','5',0,2,'2026-07-14 20:00:56'),(87,11,'account_lock_duration_minutes','Account Lock Duration Minutes','Enter the numeric value used for this rule.','number','15','15',0,3,'2026-07-14 20:00:56'),(88,11,'password_expiry_days','Password Expiry Days','Enter the numeric value used for this rule.','number','90','90',0,4,'2026-07-14 20:00:56'),(89,11,'minimum_password_length','Minimum Password Length','Enter the numeric value used for this rule.','number','8','8',0,5,'2026-07-14 20:00:56'),(90,11,'require_strong_password','Require Strong Password','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,6,'2026-07-14 20:00:56'),(91,11,'auto_logout_on_inactivity','Auto Logout On Inactivity','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,7,'2026-07-14 20:00:56'),(92,11,'force_relogin_after_password_change','Force Re-login After Password Change','Turn this rule on or off for the IMS workflow.','toggle','true','true',1,8,'2026-07-14 20:00:56'),(93,12,'pos_integration_enabled','POS Integration Enabled','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,1,'2026-08-10 12:47:53'),(94,12,'payment_gateway_enabled','Payment Gateway Enabled','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,2,'2026-08-10 12:47:53'),(95,12,'email_smtp_enabled','Email SMTP Enabled','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,3,'2026-08-10 12:47:53'),(96,12,'sms_gateway_enabled','SMS Gateway Enabled','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,4,'2026-08-10 12:47:53'),(97,12,'whatsapp_notification_enabled','WhatsApp Notification Enabled','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,5,'2026-08-10 12:47:53'),(98,12,'external_sync_enabled','External Sync Enabled','Turn this rule on or off for the IMS workflow.','toggle',NULL,'false',0,6,'2026-08-10 12:47:53'),(99,12,'sync_frequency','Sync Frequency','Enter the default text value used for this rule.','text','Daily','Daily',1,7,'2026-08-10 12:47:53'),(100,12,'api_key','API Key','Enter the default text value used for this rule.','text',NULL,'',0,8,'2026-08-10 12:47:53'),(101,12,'webhook_url','Webhook URL','Enter the default text value used for this rule.','text',NULL,'',0,9,'2026-08-10 12:47:53');
/*!40000 ALTER TABLE `system_setting_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_setting_sections`
--

DROP TABLE IF EXISTS `system_setting_sections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_setting_sections` (
  `section_id` int NOT NULL AUTO_INCREMENT,
  `section_key` varchar(100) NOT NULL,
  `section_name` varchar(150) NOT NULL,
  `display_order` int NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`section_id`),
  UNIQUE KEY `section_key` (`section_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_setting_sections`
--

LOCK TABLES `system_setting_sections` WRITE;
/*!40000 ALTER TABLE `system_setting_sections` DISABLE KEYS */;
INSERT INTO `system_setting_sections` VALUES (1,'product_rules','Product Rules',1,1),(2,'purchase_goods_receipt','Purchase & Goods Receipt',2,1),(3,'sales_invoice','Sales & Invoice',3,1),(4,'return_refund','Return & Refund',4,1),(6,'tax_billing','Tax & Billing',5,1),(7,'advanced_stock_control','Advanced Stock Control',6,1),(8,'warehouse_bin_rack','Warehouse / Bin / Rack',7,1),(9,'audit_log_rules','Audit Log Rules',8,1),(10,'report_export','Report & Export',9,1),(11,'system_security_policy','System Security Policy',10,1),(12,'integration_settings','Integration Settings',11,1);
/*!40000 ALTER TABLE `system_setting_sections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `system_settings` (
  `setting_id` int NOT NULL AUTO_INCREMENT,
  `company_name` varchar(255) DEFAULT NULL,
  `company_email` varchar(255) DEFAULT NULL,
  `company_phone` varchar(50) DEFAULT NULL,
  `company_address` text,
  `gst_number` varchar(100) DEFAULT NULL,
  `currency` varchar(20) DEFAULT NULL,
  `timezone` varchar(100) DEFAULT NULL,
  `invoice_prefix` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `allow_negative_stock` tinyint(1) DEFAULT '0',
  `default_reorder_level` int DEFAULT '10',
  `stock_valuation_method` varchar(20) DEFAULT 'FIFO',
  `invoice_start_number` int DEFAULT '1000',
  `enable_audit_logs` tinyint(1) DEFAULT '1',
  `audit_retention_days` int DEFAULT '365',
  `low_stock_alert` tinyint(1) DEFAULT '1',
  `default_unit_type` varchar(100) DEFAULT NULL,
  `enable_barcode` tinyint(1) NOT NULL DEFAULT '0',
  `auto_stock_update` tinyint(1) NOT NULL DEFAULT '0',
  `email_notifications` tinyint(1) NOT NULL DEFAULT '1',
  `low_stock_notifications` tinyint(1) NOT NULL DEFAULT '1',
  `purchase_notifications` tinyint(1) NOT NULL DEFAULT '1',
  `sales_notifications` tinyint(1) NOT NULL DEFAULT '1',
  `system_alerts` tinyint(1) NOT NULL DEFAULT '1',
  `enable_two_factor_auth` tinyint(1) NOT NULL DEFAULT '0',
  `company_logo` varchar(500) DEFAULT NULL,
  `theme_mode` varchar(50) DEFAULT NULL,
  `language` varchar(50) DEFAULT NULL,
  `collapse_sidebar` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`setting_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `units`
--

DROP TABLE IF EXISTS `units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `units` (
  `unit_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `short_name` varchar(20) NOT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`unit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `units`
--

LOCK TABLES `units` WRITE;
/*!40000 ALTER TABLE `units` DISABLE KEYS */;
INSERT INTO `units` VALUES (1,'Licenses','License',0),(2,'Subscriptions','Sub',0),(3,'Seats','Seat',0),(4,'Pieces','Pcs',0),(5,'Months','Mo',0);
/*!40000 ALTER TABLE `units` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_tokens`
--

DROP TABLE IF EXISTS `user_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_tokens` (
  `TokenId` int NOT NULL AUTO_INCREMENT,
  `UserId` int NOT NULL,
  `Token` text NOT NULL,
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`TokenId`),
  KEY `UserId` (`UserId`),
  CONSTRAINT `user_tokens_ibfk_1` FOREIGN KEY (`UserId`) REFERENCES `users` (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_tokens`
--

LOCK TABLES `user_tokens` WRITE;
/*!40000 ALTER TABLE `user_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(50) NOT NULL,
  `Email` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `PasswordHash` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Role` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `IsActive` tinyint(1) NOT NULL,
  `PhoneNumber` varchar(10) DEFAULT NULL,
  `EmployeeId` varchar(50) DEFAULT NULL,
  `Department` varchar(100) DEFAULT NULL,
  `Warehouse` varchar(100) DEFAULT NULL,
  `ProfilePhoto` varchar(255) DEFAULT NULL,
  `LastLogin` datetime DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `TokenVersion` int NOT NULL DEFAULT '1',
  `FailedLoginAttempts` int NOT NULL DEFAULT '0',
  `LockoutEnd` datetime(6) DEFAULT NULL,
  `EmailVerificationToken` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `EmailVerificationTokenExpiry` datetime(6) DEFAULT NULL,
  `IsEmailVerified` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Harinath','harinathnetha21@gmail.com','$2a$11$4Xx9qfbcUnjfIaI34ippY.MnBydFTAK3kW8Wxuh2d5ei9jlJIRQ8K','Admin',1,'6303653736','IMS-ADM-001','Inventory Management',NULL,NULL,NULL,'2026-10-02 09:00:00','2026-10-02 09:00:00',1,0,NULL,NULL,NULL,1);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `variant_attribute_values`
--

DROP TABLE IF EXISTS `variant_attribute_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `variant_attribute_values` (
  `id` int NOT NULL AUTO_INCREMENT,
  `variant_id` int DEFAULT NULL,
  `attribute_id` int DEFAULT NULL,
  `value_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `variant_id` (`variant_id`),
  KEY `attribute_id` (`attribute_id`),
  KEY `value_id` (`value_id`),
  CONSTRAINT `variant_attribute_values_ibfk_1` FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`variant_id`),
  CONSTRAINT `variant_attribute_values_ibfk_2` FOREIGN KEY (`attribute_id`) REFERENCES `attributes` (`attribute_id`),
  CONSTRAINT `variant_attribute_values_ibfk_3` FOREIGN KEY (`value_id`) REFERENCES `attribute_values` (`value_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `variant_attribute_values`
--

LOCK TABLES `variant_attribute_values` WRITE;
/*!40000 ALTER TABLE `variant_attribute_values` DISABLE KEYS */;
/*!40000 ALTER TABLE `variant_attribute_values` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouse_transfer_audits`
--

DROP TABLE IF EXISTS `warehouse_transfer_audits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouse_transfer_audits` (
  `warehouse_transfer_audit_id` int NOT NULL AUTO_INCREMENT,
  `transfer_id` int NOT NULL,
  `product_id` int NOT NULL,
  `variant_id` int DEFAULT NULL,
  `from_warehouse_id` int NOT NULL,
  `to_warehouse_id` int NOT NULL,
  `quantity` decimal(18,2) NOT NULL,
  `user_id` int DEFAULT NULL,
  `user_name` varchar(256) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`warehouse_transfer_audit_id`),
  KEY `idx_warehouse_transfer_audits_transfer` (`transfer_id`),
  KEY `idx_warehouse_transfer_audits_product` (`product_id`),
  KEY `idx_warehouse_transfer_audits_from_warehouse` (`from_warehouse_id`),
  KEY `idx_warehouse_transfer_audits_to_warehouse` (`to_warehouse_id`),
  KEY `idx_warehouse_transfer_audits_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouse_transfer_audits`
--

LOCK TABLES `warehouse_transfer_audits` WRITE;
/*!40000 ALTER TABLE `warehouse_transfer_audits` DISABLE KEYS */;
/*!40000 ALTER TABLE `warehouse_transfer_audits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouse_users`
--

DROP TABLE IF EXISTS `warehouse_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouse_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `warehouse_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `role` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `warehouse_users_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouse_users`
--

LOCK TABLES `warehouse_users` WRITE;
/*!40000 ALTER TABLE `warehouse_users` DISABLE KEYS */;
/*!40000 ALTER TABLE `warehouse_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouse_zones`
--

DROP TABLE IF EXISTS `warehouse_zones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouse_zones` (
  `zone_id` int NOT NULL AUTO_INCREMENT,
  `warehouse_id` int DEFAULT NULL,
  `zone_name` varchar(100) DEFAULT NULL,
  `description` text,
  PRIMARY KEY (`zone_id`),
  KEY `warehouse_id` (`warehouse_id`),
  CONSTRAINT `warehouse_zones_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`warehouse_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouse_zones`
--

LOCK TABLES `warehouse_zones` WRITE;
/*!40000 ALTER TABLE `warehouse_zones` DISABLE KEYS */;
/*!40000 ALTER TABLE `warehouse_zones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `warehouses`
--

DROP TABLE IF EXISTS `warehouses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `warehouses` (
  `warehouse_id` int NOT NULL AUTO_INCREMENT,
  `warehouse_code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `location` varchar(255) NOT NULL,
  `manager_name` varchar(150) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `email` varchar(255) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL,
  `is_deleted` bit(1) NOT NULL DEFAULT b'0',
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`warehouse_id`),
  UNIQUE KEY `uq_warehouse_name` (`name`),
  UNIQUE KEY `uq_warehouse_code` (`warehouse_code`),
  UNIQUE KEY `uq_warehouse_email` (`email`),
  KEY `idx_warehouse_status` (`status`),
  KEY `idx_warehouse_location` (`location`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `warehouses`
--

LOCK TABLES `warehouses` WRITE;
/*!40000 ALTER TABLE `warehouses` DISABLE KEYS */;
INSERT INTO `warehouses` VALUES (1,'WH-VIJ-429','Vijayawada main warehouse','Vijayawada','Warehouse Manager','0000000000','warehouse1@example.com','active','2026-08-17 01:12:29',NULL,_binary '\0',NULL),(2,'WH-HYD-809','Hyderabad central warehouse','Hyderabad','Warehouse Manager','0000000000','warehouse2@example.com','active','2026-08-17 01:13:33',NULL,_binary '\0',NULL),(3,'WH-VIZ-625','Vizag big warehouse','Vizag','Warehouse Manager','0000000000','warehouse3@example.com','active','2026-08-17 01:15:09',NULL,_binary '\0',NULL);
/*!40000 ALTER TABLE `warehouses` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */; 
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-31  9:10:23
