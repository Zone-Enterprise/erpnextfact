# Database Migration Utilities

This module provides a comprehensive set of utilities for database migrations in ERPNext. These tools help reduce code duplication and improve the reliability of database patches.

## Features

- **Batch Processing**: Process large datasets in manageable chunks
- **Progress Tracking**: Real-time progress updates for long-running migrations
- **Error Handling**: Graceful error handling with detailed logging
- **Data Validation**: Validate data before and after migrations
- **Safe Operations**: Built-in safeguards for schema changes

## Available Functions

### 1. `batch_migrate()`

Process documents in batches with a callback function.

**Usage:**
```python
from erpnext.utilities.migration import batch_migrate

def update_status(records):
    for record in records:
        frappe.db.set_value("Sales Order", record.name, "custom_status", "Processed")

stats = batch_migrate(
    "Sales Order", 
    {"status": "Pending"}, 
    batch_size=1000, 
    callback_fn=update_status
)

print(f"Processed {stats['total_processed']} records in {stats['total_batches']} batches")
```

**Parameters:**
- `doctype` (str): DocType to process
- `filters` (dict): Optional filters to apply
- `batch_size` (int): Number of records per batch (default: 5000)
- `callback_fn` (callable): Function to call for each batch
- `commit` (bool): Whether to commit after each batch (default: True)

**Returns:** Dictionary with migration statistics

### 2. `safe_bulk_update()`

Safely update multiple fields in bulk with automatic batching.

**Usage:**
```python
from erpnext.utilities.migration import safe_bulk_update

stats = safe_bulk_update(
    "Item", 
    {"item_group": "Old Group"},
    {"item_group": "New Group", "disabled": 0},
    batch_size=1000
)

print(f"Updated {stats['total_processed']} items")
```

**Parameters:**
- `doctype` (str): DocType to update
- `filters` (dict): Filters to select records
- `field_updates` (dict): Dictionary of field names and values
- `batch_size` (int): Records per batch (default: 5000)
- `validate_before` (bool): Validate fields exist (default: True)
- `update_modified` (bool): Update timestamp (default: False)

### 3. `migrate_data()`

Migrate data between doctypes with field mapping and transformation.

**Usage:**
```python
from erpnext.utilities.migration import migrate_data

def transform_record(source_record, target_data):
    # Custom transformation logic
    target_data["full_name"] = f"{source_record.first_name} {source_record.last_name}"
    return target_data

stats = migrate_data(
    source_doctype="Old Customer",
    target_doctype="Customer",
    field_mapping={
        "customer_name": "name",
        "email": "email_id",
        "phone": "mobile_no"
    },
    transformer=transform_record
)

print(f"Migrated: {stats['migrated']}, Skipped: {stats['skipped']}")
```

**Parameters:**
- `source_doctype` (str): Source DocType
- `target_doctype` (str): Target DocType
- `field_mapping` (dict): Map of source_field: target_field
- `filters` (dict): Filters for source records
- `batch_size` (int): Records per batch (default: 5000)
- `transformer` (callable): Optional transformation function
- `validate_fn` (callable): Optional validation function

### 4. `rename_field_safe()`

Safely rename a field with validation and error handling.

**Usage:**
```python
from erpnext.utilities.migration import rename_field_safe

success = rename_field_safe("Sales Order", "old_status", "new_status")

if success:
    print("Field renamed successfully")
```

**Parameters:**
- `doctype` (str): DocType containing the field
- `old_fieldname` (str): Current field name
- `new_fieldname` (str): New field name
- `force` (bool): Force rename even if field doesn't exist

### 5. `add_index_safe()` and `drop_index_safe()`

Safely manage database indexes.

**Important:** Adding indexes uses ALTER TABLE which locks the table during execution. For large tables in production environments, consider running these operations during maintenance windows.

**Usage:**
```python
from erpnext.utilities.migration import add_index_safe, drop_index_safe

# Add index
# Note: Will lock table during execution - use maintenance windows for large tables
add_index_safe("Sales Order", ["customer", "posting_date"], "customer_date_idx")

# Drop index
drop_index_safe("Sales Order", "customer_date_idx")
```

**Parameters:**
- `doctype` (str): DocType for the index
- `fields` (list): List of field names (for add_index_safe)
- `index_name` (str): Name of the index (auto-generated with 'custom_' prefix if not provided)

**Database Compatibility:**
- Supports both MariaDB/MySQL and PostgreSQL
- Automatically detects database type and uses appropriate queries
- Index names are truncated to 64 characters (MySQL limit)

### 6. `validate_data_migration()`

Validate data in fields and optionally fix invalid records.

**Usage:**
```python
from erpnext.utilities.migration import validate_data_migration
import re

def is_valid_email(value):
    return bool(re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', value or ''))

stats = validate_data_migration(
    "Customer", 
    "email_id", 
    is_valid_email,
    fix_invalid=True
)

print(f"Valid: {stats['valid']}, Invalid: {stats['invalid']}")
```

**Parameters:**
- `doctype` (str): DocType to validate
- `field` (str): Field to validate
- `validation_fn` (callable): Function that returns True if valid
- `filters` (dict): Optional filters
- `batch_size` (int): Records per batch (default: 5000)
- `fix_invalid` (bool): Attempt to fix invalid records

### 7. `get_migration_progress()`

Get progress statistics for migration operations.

**Usage:**
```python
from erpnext.utilities.migration import get_migration_progress

progress = get_migration_progress("Sales Order", {"status": "Pending"})
print(f"Total records to migrate: {progress['total']}")
```

## Best Practices

### 1. Always Use Batching for Large Datasets

```python
# Good: Uses batching
stats = batch_migrate("Item", {}, batch_size=5000, callback_fn=process_items)

# Bad: Trying to process all records at once
items = frappe.get_all("Item")  # Could be millions of records
for item in items:
    process_item(item)
```

### 2. Validate Before Migrating

```python
# Good: Validate first
stats = validate_data_migration("Customer", "email_id", is_valid_email)
if stats['invalid'] > 0:
    print(f"Found {stats['invalid']} invalid emails - fix before migrating")

# Then proceed with migration if validation passes
```

### 3. Use Transactions Appropriately

```python
# For large migrations, commit after each batch
stats = batch_migrate(
    "Sales Order", 
    filters={}, 
    batch_size=1000,
    callback_fn=update_records,
    commit=True  # Commit after each batch
)

# For small migrations, commit once at the end
stats = batch_migrate(
    "Sales Order", 
    filters={"name": ["in", small_list]}, 
    batch_size=100,
    callback_fn=update_records,
    commit=False
)
frappe.db.commit()
```

### 4. Log Errors for Debugging

```python
def update_with_logging(records):
    for record in records:
        try:
            # Your update logic
            frappe.db.set_value("Item", record.name, "field", "value")
        except Exception as e:
            frappe.log_error(
                f"Error updating {record.name}: {str(e)}", 
                "Migration Error"
            )
```

### 5. Test Migrations on Staging First

Always test your migration scripts on a staging environment before running them on production:

```python
# Add a safety check
if frappe.conf.get("environment") == "production":
    frappe.throw("Run this migration on staging first!")
```

## Example: Complete Migration Patch

Here's a complete example of a migration patch using these utilities:

```python
# erpnext/patches/v16_0/update_item_pricing.py
import frappe
from erpnext.utilities.migration import batch_migrate, validate_data_migration

def execute():
    """Update item pricing structure for v16"""
    
    # Step 1: Validate existing data
    def is_valid_price(value):
        return value is not None and value >= 0
    
    validation_stats = validate_data_migration(
        "Item Price",
        "price_list_rate",
        is_valid_price
    )
    
    if validation_stats['invalid'] > 0:
        frappe.log_error(
            f"Found {validation_stats['invalid']} items with invalid prices",
            "Item Price Validation"
        )
    
    # Step 2: Perform migration
    def update_pricing(records):
        for record in records:
            try:
                doc = frappe.get_doc("Item Price", record.name)
                # Update pricing logic
                doc.new_price = doc.price_list_rate * 1.1
                doc.save(ignore_permissions=True)
            except Exception as e:
                frappe.log_error(
                    f"Error updating {record.name}: {str(e)}",
                    "Item Price Migration"
                )
    
    stats = batch_migrate(
        "Item Price",
        filters={"modified": ["<", "2024-01-01"]},
        batch_size=1000,
        callback_fn=update_pricing,
        commit=True
    )
    
    frappe.msgprint(
        f"Migration complete: {stats['total_processed']} items updated, "
        f"{len(stats['errors'])} errors"
    )
```

## Testing

Run the test suite to verify functionality:

```bash
bench --site [site-name] run-tests --module erpnext.utilities.test_migration
```

## Contributing

When adding new migration utilities:

1. Follow the existing code patterns
2. Add comprehensive docstrings
3. Include error handling and logging
4. Write unit tests
5. Update this documentation

## Support

For issues or questions, please refer to:
- [ERPNext Documentation](https://docs.erpnext.com/)
- [Frappe Forum](https://discuss.erpnext.com/)
- [GitHub Issues](https://github.com/frappe/erpnext/issues)
