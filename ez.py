#!/usr/bin/env python3
"""
Delete all background.png files in the themes folder.
"""

import os

def delete_png_files(themes_dir="static/themes"):
    """Delete all background.png files in the themes directory."""
    
    if not os.path.exists(themes_dir):
        print(f"Error: Themes directory '{themes_dir}' not found!")
        return False
    
    deleted_count = 0
    
    print(f"Scanning for background.png files in '{themes_dir}'...")
    
    for root, dirs, files in os.walk(themes_dir):
        for file in files:
            if file.lower() == "background.png":
                png_path = os.path.join(root, file)
                try:
                    os.remove(png_path)
                    print(f"✓ Deleted: {png_path}")
                    deleted_count += 1
                except Exception as e:
                    print(f"✗ Error deleting {png_path}: {e}")
    
    print(f"\nDeleted {deleted_count} background.png files")
    return deleted_count > 0

if __name__ == "__main__":
    delete_png_files()
