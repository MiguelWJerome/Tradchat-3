#!/usr/bin/env python3
"""
Convert all background.png files to background.jpg in the themes folder using Pillow.
This script maintains the same image quality while converting from PNG to JPG format.
"""

import os
from PIL import Image
import sys

def convert_png_to_jpg(themes_dir="static/themes"):
    """
    Convert all background.png files to background.jpg in the specified themes directory.
    
    Args:
        themes_dir (str): Path to the themes directory containing subfolders with background.png files
    """
    
    # Check if themes directory exists
    if not os.path.exists(themes_dir):
        print(f"Error: Themes directory '{themes_dir}' not found!")
        return False
    
    converted_count = 0
    error_count = 0
    
    print(f"Scanning for background.png files in '{themes_dir}'...")
    
    # Walk through all subdirectories in the themes folder
    for root, dirs, files in os.walk(themes_dir):
        for file in files:
            if file.lower() == "background.png":
                png_path = os.path.join(root, file)
                jpg_path = os.path.join(root, "background.jpg")
                
                try:
                    # Open the PNG image
                    with Image.open(png_path) as img:
                        # Convert to RGB mode (required for JPG)
                        if img.mode != 'RGB':
                            img = img.convert('RGB')
                        
                        # Save as JPG with high quality
                        img.save(jpg_path, 'JPEG', quality=95, optimize=True)
                        
                        # Get file sizes for comparison
                        png_size = os.path.getsize(png_path)
                        jpg_size = os.path.getsize(jpg_path)
                        
                        print(f"✓ Converted: {png_path} -> {jpg_path}")
                        print(f"  Size: {png_size:,} bytes -> {jpg_size:,} bytes ({(jpg_size/png_size)*100:.1f}% of original)")
                        
                        converted_count += 1
                        
                except Exception as e:
                    print(f"✗ Error converting {png_path}: {e}")
                    error_count += 1
    
    print(f"\nConversion complete!")
    print(f"Successfully converted: {converted_count} files")
    print(f"Errors encountered: {error_count} files")
    
    return converted_count > 0

def main():
    """Main function to run the conversion process."""
    
    print("=== PNG to JPG Converter for Theme Backgrounds ===\n")
    
    # Try to find the themes directory
    possible_paths = [
        "static/themes",
        "../static/themes", 
        "./static/themes",
        "themes"
    ]
    
    themes_path = None
    for path in possible_paths:
        if os.path.exists(path):
            themes_path = path
            break
    
    if not themes_path:
        print("Error: Could not find themes directory!")
        print("Please make sure you're running this script from the correct location.")
        print("Expected themes directory at one of:")
        for path in possible_paths:
            print(f"  - {path}")
        sys.exit(1)
    
    # Run the conversion
    success = convert_png_to_jpg(themes_path)
    
    if not success:
        print("No background.png files were found or converted.")
        sys.exit(1)
    
    print("\nAll conversions completed successfully!")

if __name__ == "__main__":
    main()
