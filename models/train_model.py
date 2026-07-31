import os
import tensorflow as tf
import matplotlib.pyplot as plt
import numpy as np
import random
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV3Large
from tensorflow.keras.applications.mobilenet_v3 import preprocess_input
from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from tensorflow.keras.preprocessing import image

print(f"GPU Available: {len(tf.config.list_physical_devices('GPU')) > 0}")
if not len(tf.config.list_physical_devices('GPU')) > 0:
    print("⚠️ CẢNH BÁO: Hãy bật GPU T4 trong Runtime settings để train nhanh hơn!")

base_dir = 'dataset_folder/LCC_FASD'

TRAIN_DIR = os.path.join(base_dir, 'LCC_FASD_training')
VAL_DIR = os.path.join(base_dir, 'LCC_FASD_development')

if not os.path.exists(TRAIN_DIR):
    print(f"❌ Lỗi: Không tìm thấy thư mục {TRAIN_DIR}")
    print("Vui lòng kiểm tra lại tên folder.")
else:
    print(f" Đã tìm thấy dữ liệu Train tại: {TRAIN_DIR}")
    print(f" Đã tìm thấy dữ liệu Val tại:   {VAL_DIR}")

    classes_in_train = os.listdir(TRAIN_DIR)
    print(f" Các lớp tìm thấy trong Train: {classes_in_train}")

IMG_SIZE = (224, 224)
BATCH_SIZE = 64

train_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    rotation_range=30,
    width_shift_range=0.2,
    height_shift_range=0.2,
    shear_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
    brightness_range=[0.7, 1.3],
    fill_mode='nearest'
)

val_datagen = ImageDataGenerator(preprocessing_function=preprocess_input)

print("\n>>> Đang load dữ liệu vào Generators...")

train_generator = train_datagen.flow_from_directory(
    TRAIN_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='binary',
    shuffle=True
)

val_generator = val_datagen.flow_from_directory(
    VAL_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='binary',
    shuffle=False
)

print(f"Mapping Nhãn: {train_generator.class_indices}")
def build_model():
    base_model = MobileNetV3Large(input_shape=(224, 224, 3), include_top=False, weights='imagenet')
    base_model.trainable = False

    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(256, activation='relu')(x)
    x = Dropout(0.4)(x)
    predictions = Dense(1, activation='sigmoid')(x)

    model = Model(inputs=base_model.input, outputs=predictions)

    model.compile(optimizer=Adam(learning_rate=0.001),
                  loss='binary_crossentropy',
                  metrics=['accuracy'])
    return model

model = build_model()

callbacks = [
    EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True, verbose=1),
    ReduceLROnPlateau(monitor='val_loss', factor=0.2, patience=2, verbose=1, min_lr=1e-6),
    ModelCheckpoint('best_antispoof.keras', monitor='val_accuracy', save_best_only=True, verbose=1)
]

print("\n>>> Bắt đầu Train Giai đoạn 1 (Đóng băng nền)...")
history = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=15,
    callbacks=callbacks
)

print("\n>>> Bắt đầu Train Giai đoạn 2 (Fine-Tuning)...")

model.trainable = True

fine_tune_at = len(model.layers) - 50

for layer in model.layers[:fine_tune_at]:
    layer.trainable = False

print(f"Đã đóng băng {fine_tune_at} lớp đầu, chỉ train {len(model.layers) - fine_tune_at} lớp cuối.")

model.compile(optimizer=Adam(learning_rate=1e-5),
              loss='binary_crossentropy',
              metrics=['accuracy'])

history_fine = model.fit(
    train_generator,
    validation_data=val_generator,
    epochs=10,
    callbacks=callbacks
)

def plot_history(h1, h2):
    acc = h1.history['accuracy'] + h2.history['accuracy']
    val_acc = h1.history['val_accuracy'] + h2.history['val_accuracy']
    loss = h1.history['loss'] + h2.history['loss']
    val_loss = h1.history['val_loss'] + h2.history['val_loss']

    plt.figure(figsize=(12, 5))

    plt.subplot(1, 2, 1)
    plt.plot(acc, label='Train Accuracy')
    plt.plot(val_acc, label='Val Accuracy')
    plt.axvline(x=len(h1.history['accuracy']), color='green', linestyle='--', label='Start Fine-Tuning')
    plt.title('Accuracy')
    plt.legend()

    plt.subplot(1, 2, 2)
    plt.plot(loss, label='Train Loss')
    plt.plot(val_loss, label='Val Loss')
    plt.axvline(x=len(h1.history['accuracy']), color='green', linestyle='--', label='Start Fine-Tuning')
    plt.title('Loss')
    plt.legend()
    plt.show()

print("\n--- Biểu đồ huấn luyện toàn bộ ---")
plot_history(history, history_fine)

model.save('antispoof_final.keras')
print("Đã lưu model final: antispoof_final.keras")