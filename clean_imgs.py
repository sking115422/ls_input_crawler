import imagehash
from PIL import Image
import os

img_dir = "./ss/"

# Seting threshold for similarity
threshold = 5

img_list = os.listdir(img_dir)
rem_list = []

for i, img1 in enumerate(img_list):
    
    print(i)
    
    image1 = Image.open(img_dir+img1)
    hash1 = imagehash.phash(image1)
    
    for j, img2 in enumerate(img_list):
        
        if i != j:
            
            image2 = Image.open(img_dir+img2)
            hash2 = imagehash.phash(image2)

            # Calculate Hamming distance
            distance = abs(hash1 - hash2)

            # Compare the images
            if distance <= threshold:
                rem_list.append(img_dir+img2)
            
print(rem_list)

rem_list = list(set(rem_list))

for each in rem_list:
    os.remove(each)