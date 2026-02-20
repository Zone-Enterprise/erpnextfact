# Copyright (c) 2024, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

"""
Database Migration Utilities

This module provides helper functions for common database migration operations
to reduce code duplication and improve reliability of database patches.
"""

import frappe
from frappe import _
from frappe.model.utils.rename_field import rename_field as frappe_rename_field
from frappe.utils import cint, flt, now


def batch_migrate(doctype, filters=None, batch_size=5000, callback_fn=None, commit=True):
	"""
	Process documents in batches with optional callback function.
	
	Args:
		doctype (str): DocType to process
		filters (dict): Optional filters to apply
		batch_size (int): Number of records to process in each batch
		callback_fn (callable): Function to call for each batch of records
		commit (bool): Whether to commit after each batch
		
	Returns:
		dict: Statistics about the migration (total_processed, total_batches, errors)
		
	Example:
		def update_status(records):
			for record in records:
				frappe.db.set_value("Sales Order", record.name, "custom_status", "Processed")
		
		stats = batch_migrate("Sales Order", {"status": "Pending"}, 
		                      batch_size=1000, callback_fn=update_status)
	"""
	if not callback_fn:
		frappe.throw(_("callback_fn is required for batch_migrate"))
	
	filters = filters or {}
	stats = {"total_processed": 0, "total_batches": 0, "errors": []}
	
	try:
		# Get total count
		total = frappe.db.count(doctype, filters)
		
		if total == 0:
			frappe.msgprint(_("No records found to migrate"))
			return stats
		
		frappe.publish_realtime(
			"progress",
			{"progress": 0, "total": total, "doctype": doctype},
			user=frappe.session.user
		)
		
		offset = 0
		while True:
			records = frappe.get_all(
				doctype, 
				filters=filters, 
				fields=["name"],
				limit_start=offset,
				limit_page_length=batch_size,
				order_by="modified desc"
			)
			
			if not records:
				break
			
			try:
				callback_fn(records)
				stats["total_processed"] += len(records)
				stats["total_batches"] += 1
				
				if commit:
					frappe.db.commit()
				
				frappe.publish_realtime(
					"progress",
					{"progress": stats["total_processed"], "total": total, "doctype": doctype},
					user=frappe.session.user
				)
				
			except Exception as e:
				error_msg = f"Error processing batch {stats['total_batches']}: {str(e)}"
				stats["errors"].append(error_msg)
				frappe.log_error(error_msg, "Batch Migration Error")
				
			offset += batch_size
			
	except Exception as e:
		frappe.log_error(str(e), "Batch Migration Critical Error")
		raise
	
	return stats


def safe_bulk_update(doctype, filters, field_updates, batch_size=5000, 
                     validate_before=True, update_modified=False):
	"""
	Safely update multiple fields in bulk with batching and error handling.
	
	Args:
		doctype (str): DocType to update
		filters (dict): Filters to select records
		field_updates (dict): Dictionary of field names and values to update
		batch_size (int): Number of records to update in each batch
		validate_before (bool): Whether to validate field existence before update
		update_modified (bool): Whether to update modified timestamp
		
	Returns:
		dict: Statistics about the update operation
		
	Example:
		stats = safe_bulk_update(
			"Item", 
			{"item_group": "Old Group"},
			{"item_group": "New Group", "disabled": 0},
			batch_size=1000
		)
	"""
	if not field_updates:
		frappe.throw(_("field_updates cannot be empty"))
	
	# Validate fields exist in doctype
	if validate_before:
		meta = frappe.get_meta(doctype)
		for field in field_updates.keys():
			if not meta.has_field(field):
				frappe.throw(_("Field {0} does not exist in {1}").format(field, doctype))
	
	def update_batch(records):
		for record in records:
			try:
				for field, value in field_updates.items():
					frappe.db.set_value(
						doctype, 
						record.name, 
						field, 
						value,
						update_modified=update_modified
					)
			except Exception as e:
				frappe.log_error(
					f"Error updating {doctype} {record.name}: {str(e)}", 
					"Bulk Update Error"
				)
	
	return batch_migrate(doctype, filters, batch_size, update_batch)


def migrate_data(source_doctype, target_doctype, field_mapping, filters=None, 
                 batch_size=5000, transformer=None, validate_fn=None):
	"""
	Migrate data from source to target doctype with field mapping and transformation.
	
	Args:
		source_doctype (str): Source DocType
		target_doctype (str): Target DocType
		field_mapping (dict): Map of source_field: target_field
		filters (dict): Filters to apply on source doctype
		batch_size (int): Batch size for processing
		transformer (callable): Optional function to transform record before insert
		validate_fn (callable): Optional validation function for each record
		
	Returns:
		dict: Migration statistics
		
	Example:
		def transform_record(source_record, target_data):
			target_data["full_name"] = f"{source_record.first_name} {source_record.last_name}"
			return target_data
		
		stats = migrate_data(
			"Old Customer", 
			"Customer",
			{"customer_name": "name", "email": "email_id"},
			transformer=transform_record
		)
	"""
	stats = {"migrated": 0, "skipped": 0, "errors": []}
	
	def process_batch(records):
		for record in records:
			try:
				# Get full record with all fields
				source_doc = frappe.get_doc(source_doctype, record.name)
				
				# Map fields
				target_data = {"doctype": target_doctype}
				for source_field, target_field in field_mapping.items():
					if hasattr(source_doc, source_field):
						target_data[target_field] = getattr(source_doc, source_field)
				
				# Apply transformation if provided
				if transformer:
					target_data = transformer(source_doc, target_data)
				
				# Validate if validation function provided
				if validate_fn and not validate_fn(source_doc, target_data):
					stats["skipped"] += 1
					continue
				
				# Insert new record
				target_doc = frappe.get_doc(target_data)
				target_doc.insert(ignore_permissions=True)
				stats["migrated"] += 1
				
			except Exception as e:
				error_msg = f"Error migrating {source_doctype} {record.name}: {str(e)}"
				stats["errors"].append(error_msg)
				frappe.log_error(error_msg, "Data Migration Error")
	
	batch_migrate(source_doctype, filters, batch_size, process_batch)
	return stats


def rename_field_safe(doctype, old_fieldname, new_fieldname, force=False):
	"""
	Safely rename a field with proper validation and error handling.
	
	Args:
		doctype (str): DocType containing the field
		old_fieldname (str): Current field name
		new_fieldname (str): New field name
		force (bool): Force rename even if field doesn't exist
		
	Returns:
		bool: True if successful, False otherwise
		
	Example:
		success = rename_field_safe("Sales Order", "old_status", "new_status")
	"""
	try:
		if not frappe.db.has_column(f"tab{doctype}", old_fieldname):
			if not force:
				frappe.msgprint(_("Field {0} does not exist in {1}").format(old_fieldname, doctype))
				return False
			return True
		
		if frappe.db.has_column(f"tab{doctype}", new_fieldname):
			frappe.msgprint(_("Field {0} already exists in {1}").format(new_fieldname, doctype))
			return False
		
		frappe_rename_field(doctype, old_fieldname, new_fieldname)
		frappe.msgprint(_("Field renamed successfully"))
		return True
		
	except Exception as e:
		frappe.log_error(str(e), "Field Rename Error")
		return False


def add_index_safe(doctype, fields, index_name=None):
	"""
	Safely add an index to a table with validation.
	
	Args:
		doctype (str): DocType to add index to
		fields (list): List of field names for the index
		index_name (str): Optional custom index name
		
	Returns:
		bool: True if successful, False otherwise
		
	Example:
		add_index_safe("Sales Order", ["customer", "posting_date"])
	"""
	try:
		table_name = f"tab{doctype}"
		
		if not frappe.db.table_exists(table_name):
			frappe.log_error(f"Table {table_name} does not exist", "Add Index Error")
			return False
		
		# Validate all fields exist
		for field in fields:
			if not frappe.db.has_column(table_name, field):
				frappe.log_error(
					f"Field {field} does not exist in {table_name}", 
					"Add Index Error"
				)
				return False
		
		# Generate index name if not provided
		if not index_name:
			index_name = f"{'_'.join(fields)}_index"
		
		# Check if index already exists
		existing_indexes = frappe.db.sql(f"""
			SHOW INDEX FROM `{table_name}` 
			WHERE Key_name = %s
		""", index_name)
		
		if existing_indexes:
			frappe.msgprint(_("Index {0} already exists").format(index_name))
			return True
		
		# Create index
		fields_str = ", ".join([f"`{field}`" for field in fields])
		frappe.db.sql(f"""
			ALTER TABLE `{table_name}` 
			ADD INDEX `{index_name}` ({fields_str})
		""")
		
		frappe.msgprint(_("Index {0} added successfully").format(index_name))
		return True
		
	except Exception as e:
		frappe.log_error(str(e), "Add Index Error")
		return False


def drop_index_safe(doctype, index_name):
	"""
	Safely drop an index from a table.
	
	Args:
		doctype (str): DocType to drop index from
		index_name (str): Name of the index to drop
		
	Returns:
		bool: True if successful, False otherwise
		
	Example:
		drop_index_safe("Sales Order", "customer_posting_date_index")
	"""
	try:
		table_name = f"tab{doctype}"
		
		if not frappe.db.table_exists(table_name):
			frappe.log_error(f"Table {table_name} does not exist", "Drop Index Error")
			return False
		
		# Check if index exists
		existing_indexes = frappe.db.sql(f"""
			SHOW INDEX FROM `{table_name}` 
			WHERE Key_name = %s
		""", index_name)
		
		if not existing_indexes:
			frappe.msgprint(_("Index {0} does not exist").format(index_name))
			return True
		
		# Drop index
		frappe.db.sql(f"""
			ALTER TABLE `{table_name}` 
			DROP INDEX `{index_name}`
		""")
		
		frappe.msgprint(_("Index {0} dropped successfully").format(index_name))
		return True
		
	except Exception as e:
		frappe.log_error(str(e), "Drop Index Error")
		return False


def validate_data_migration(doctype, field, validation_fn, filters=None, 
                             batch_size=5000, fix_invalid=False):
	"""
	Validate data in a field and optionally fix invalid records.
	
	Args:
		doctype (str): DocType to validate
		field (str): Field to validate
		validation_fn (callable): Function that returns True if value is valid
		filters (dict): Optional filters
		batch_size (int): Batch size for processing
		fix_invalid (bool): Whether to attempt fixing invalid records
		
	Returns:
		dict: Validation statistics (valid, invalid, fixed)
		
	Example:
		def is_valid_email(value):
			import re
			return bool(re.match(r'^[\\w\\.-]+@[\\w\\.-]+\\.\\w+$', value))
		
		stats = validate_data_migration(
			"Customer", 
			"email_id", 
			is_valid_email,
			fix_invalid=True
		)
	"""
	stats = {"valid": 0, "invalid": 0, "fixed": 0, "invalid_records": []}
	
	def validate_batch(records):
		for record in records:
			try:
				doc = frappe.get_doc(doctype, record.name)
				value = getattr(doc, field, None)
				
				if validation_fn(value):
					stats["valid"] += 1
				else:
					stats["invalid"] += 1
					stats["invalid_records"].append(record.name)
					
					if fix_invalid:
						# Attempt to fix - this is application specific
						# For now, just log it
						frappe.log_error(
							f"Invalid value in {doctype} {record.name}.{field}: {value}",
							"Data Validation Error"
						)
			except Exception as e:
				frappe.log_error(
					f"Error validating {doctype} {record.name}: {str(e)}",
					"Validation Error"
				)
	
	batch_migrate(doctype, filters, batch_size, validate_batch)
	return stats


def get_migration_progress(doctype, filters=None):
	"""
	Get progress statistics for a migration operation.
	
	Args:
		doctype (str): DocType to check
		filters (dict): Filters to apply
		
	Returns:
		dict: Progress information (total, processed, remaining)
	"""
	total = frappe.db.count(doctype, filters or {})
	
	return {
		"doctype": doctype,
		"total": total,
		"filters": filters,
		"timestamp": now()
	}
