# Copyright (c) 2024, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

"""
Example migration patch demonstrating the use of migration utilities.

This is a template/example patch that shows how to use the database 
migration utilities provided in erpnext.utilities.migration.

To create your own patch:
1. Copy this file to erpnext/patches/vX_Y/your_patch_name.py
2. Modify the execute() function with your migration logic
3. Add the patch path to erpnext/patches.txt
"""

import frappe
from erpnext.utilities.migration import (
	batch_migrate,
	safe_bulk_update,
	validate_data_migration,
	get_migration_progress,
)


def execute():
	"""
	Main patch execution function.
	This function is called by the Frappe framework when running patches.
	"""
	
	# Example 1: Simple bulk update
	# Update all pending sales orders to a new status
	example_bulk_update()
	
	# Example 2: Batch migration with custom logic
	# Process items in batches with custom transformation
	example_batch_migration()
	
	# Example 3: Data validation before migration
	# Validate email addresses before migrating customer data
	example_data_validation()
	
	# Example 4: Progress tracking
	# Track progress of a long-running migration
	example_progress_tracking()


def example_bulk_update():
	"""
	Example: Simple bulk update of records
	
	This example shows how to update multiple fields in bulk
	across many records efficiently.
	"""
	# Uncomment to run this example
	# stats = safe_bulk_update(
	# 	"Sales Order",
	# 	{"status": "To Deliver and Bill"},  # Filter
	# 	{"custom_migration_flag": 1},  # Updates to apply
	# 	batch_size=1000,
	# 	update_modified=False
	# )
	# 
	# frappe.msgprint(f"Updated {stats['total_processed']} sales orders")
	pass


def example_batch_migration():
	"""
	Example: Batch migration with custom callback
	
	This example shows how to process records in batches with
	custom transformation logic.
	"""
	def process_items(records):
		"""Custom processing for each batch of items"""
		for record in records:
			try:
				# Get the full item document
				item = frappe.get_doc("Item", record.name)
				
				# Custom transformation logic
				if item.item_group == "Old Group":
					item.item_group = "New Group"
					item.custom_migrated = 1
					item.save(ignore_permissions=True)
					
			except Exception as e:
				frappe.log_error(
					f"Error processing item {record.name}: {str(e)}",
					"Item Migration Error"
				)
	
	# Uncomment to run this example
	# stats = batch_migrate(
	# 	"Item",
	# 	{"item_group": "Old Group"},
	# 	batch_size=500,
	# 	callback_fn=process_items,
	# 	commit=True
	# )
	# 
	# frappe.msgprint(
	# 	f"Processed {stats['total_processed']} items in "
	# 	f"{stats['total_batches']} batches with {len(stats['errors'])} errors"
	# )
	pass


def example_data_validation():
	"""
	Example: Data validation before migration
	
	This example shows how to validate data before performing
	a migration to ensure data quality.
	"""
	def is_valid_email(value):
		"""Validate email format"""
		import re
		if not value:
			return False
		return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', value))
	
	# Uncomment to run this example
	# stats = validate_data_migration(
	# 	"Customer",
	# 	"email_id",
	# 	is_valid_email,
	# 	batch_size=1000
	# )
	# 
	# if stats['invalid'] > 0:
	# 	frappe.log_error(
	# 		f"Found {stats['invalid']} customers with invalid emails. "
	# 		f"Invalid records: {stats['invalid_records'][:10]}",
	# 		"Customer Email Validation"
	# 	)
	# 	frappe.msgprint(
	# 		f"Validation complete: {stats['valid']} valid, {stats['invalid']} invalid"
	# 	)
	pass


def example_progress_tracking():
	"""
	Example: Track migration progress
	
	This example shows how to track the progress of a migration
	for monitoring and reporting purposes.
	"""
	# Uncomment to run this example
	# progress = get_migration_progress(
	# 	"Purchase Order",
	# 	{"status": "To Receive"}
	# )
	# 
	# frappe.msgprint(
	# 	f"Migration scope: {progress['total']} purchase orders to process"
	# )
	# 
	# # Then perform the actual migration
	# stats = safe_bulk_update(
	# 	"Purchase Order",
	# 	{"status": "To Receive"},
	# 	{"custom_processed": 1},
	# 	batch_size=500
	# )
	pass


def example_complex_migration():
	"""
	Example: Complex migration with multiple steps
	
	This example demonstrates a multi-step migration process
	with validation, transformation, and error handling.
	"""
	# Step 1: Validate data
	frappe.msgprint("Step 1: Validating data...")
	
	def is_valid_quantity(value):
		return value is not None and value >= 0
	
	# validation_stats = validate_data_migration(
	# 	"Stock Entry Detail",
	# 	"qty",
	# 	is_valid_quantity
	# )
	
	# if validation_stats['invalid'] > 0:
	# 	frappe.throw(
	# 		f"Found {validation_stats['invalid']} invalid quantities. "
	# 		"Fix these before proceeding."
	# 	)
	
	# Step 2: Reload doctypes if schema changed
	# frappe.reload_doc("stock", "doctype", "stock_entry")
	# frappe.reload_doc("stock", "doctype", "stock_entry_detail")
	
	# Step 3: Perform migration
	frappe.msgprint("Step 2: Migrating data...")
	
	def migrate_stock_entries(records):
		for record in records:
			try:
				se = frappe.get_doc("Stock Entry", record.name)
				# Your migration logic here
				# se.custom_new_field = calculate_value(se)
				# se.save(ignore_permissions=True)
				pass
			except Exception as e:
				frappe.log_error(
					f"Error migrating {record.name}: {str(e)}",
					"Stock Entry Migration"
				)
	
	# stats = batch_migrate(
	# 	"Stock Entry",
	# 	{"docstatus": 1},
	# 	batch_size=100,
	# 	callback_fn=migrate_stock_entries,
	# 	commit=True
	# )
	
	# Step 4: Verify migration
	frappe.msgprint("Step 3: Verifying migration...")
	
	# verification_progress = get_migration_progress(
	# 	"Stock Entry",
	# 	{"custom_new_field": ["is", "set"]}
	# )
	
	frappe.msgprint("Migration complete!")
	pass
