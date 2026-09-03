import React, { useState, useEffect } from 'react';
import { Product, CartItem, Order, SizeVariant, ViewMode, Category, UserProfile } from './types';
import { fetchProducts, fetchCategories, saveOrder, updateProduct, updateOrderEmailStatus, getSupabase, isSupabaseConfigured } from './services/supabase';
import { getLocalAuthUser, fetchUserProfile } from './services/auth';
import { sendOrderEmails } from './services/emailjs';
import { getActiveVariantImages, getItemEffectiveNormalPrice, getSelectedVariantStock, deductStockFromProduct } from './utils/variantHelpers';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { CategoryView } from './components/CategoryView';
import { ProductDetailView } from './components/ProductDetailView';
import { CartView } from './components/CartView';
import { CheckoutView } from './components/CheckoutView';
import { OrderConfirmationView } from './components/OrderConfirmationView';
import { AdminView } from './components/AdminView';
import { QuickBuyView } from './components/QuickBuyView';
import { InfoPageView } from './components/InfoPageView';
import { AuthModal } from './components/AuthModal';
import { AccountModal } from './components/AccountModal';
import { MobileOrientationLock } from './components/common/MobileOrientationLock';
import { AddedToCartNotification, CartNotificationData } from './components/common/AddedToCartNotification';

// Helper to serialize cart in a lightweight way, maintaining variant selection, image and price metadata
const serializeCartForStorage = (items: CartItem[]) => {
  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    selectedColor: item.selectedColor,
    selectedSizeVariant: item.selectedSizeVariant,
    selectedVariants: item.selectedVariants,
    selectedImage: item.selectedImage,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    isWholesale: item.isWholesale,
    totalPrice: item.totalPrice,
    product: {
      id: item.product.id,
      title: item.product.title,
      category: item.product.category,
      subcategory: item.product.subcategory,
      images: Array.isArray(item.product.images) && item.product.images.length > 0 ? item.product.images.slice(0, 5) : [],
      minWholesaleQty: item.product.minWholesaleQty,
      wholesalePrice: item.product.wholesalePrice,
      retailPrice: item.product.retailPrice,
      wholesaleCashPrice: item.product.wholesaleCashPrice,
      retailCashPrice: item.product.retailCashPrice,
      cashPrice: item.product.cashPrice,
      stock: item.product.stock,
      colors: item.product.colors,
      sizeVariants: item.product.sizeVariants,
      variantTypes: item.product.variantTypes,
      specs: item.product.specs,
    },
  }));
};

export default function App() {
  const [view, setView] = useState<ViewMode>(() => {
    if (window.location.pathname.includes('/admin') || window.location.hash.includes('admin')) {
      return 'admin';
    }
    return 'home';
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductVariants, setSelectedProductVariants] = useState<Record<string, string> | undefined>(undefined);
  const [selectedProductImage, setSelectedProductImage] = useState<string | undefined>(undefined);
  const [previousView, setPreviousView] = useState<ViewMode>('home');
  const [currentCategory, setCurrentCategory] = useState<string>('Todo');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('my_cart_items');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Aviso al recuperar carrito del almacenamiento:', e);
    }
    return [];
  });
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [cartNotification, setCartNotification] = useState<CartNotificationData | null>(null);
  const [lastShoppingView, setLastShoppingView] = useState<'home' | 'category' | 'quick_buy'>('home');

  // Dismiss cart notification immediately whenever navigating away from product_detail
  useEffect(() => {
    if (view !== 'product_detail') {
      setCartNotification(null);
    }
  }, [view]);

  // Shared Delivery & Payment Method State (persisted across views & session)
  const [deliveryOption, setDeliveryOption] = useState<'pickup' | 'delivery'>(() => {
    try {
      const saved = localStorage.getItem('my_commerce_checkout_delivery_option');
      if (saved === 'pickup' || saved === 'delivery') return saved;
    } catch (e) {}
    return 'pickup'; // Default to pickup
  });

  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash'>(() => {
    try {
      const saved = localStorage.getItem('my_commerce_checkout_payment_method');
      if (saved === 'cash' || saved === 'transfer') return saved;
    } catch (e) {}
    return 'cash'; // Default to cash for pickup
  });

  // Authentication & Account state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [targetInfoSection, setTargetInfoSection] = useState<string | null>(null);

  // Check and restore user session on mount
  useEffect(() => {
    const initAuthSession = async () => {
      const supabase = getSupabase();
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user) {
            const profile = await fetchUserProfile(data.session.user.id, data.session.user.email);
            if (profile) {
              setCurrentUser(profile);
              return;
            }
          }
        } catch (e) {
          console.warn('Error checking Supabase session:', e);
        }
      }

      // Check local storage session
      const localUser = getLocalAuthUser();
      if (localUser) {
        const profile = await fetchUserProfile(localUser.id, localUser.email);
        if (profile) {
          setCurrentUser(profile);
        }
      }
    };

    initAuthSession();
  }, []);

  // Sync cart to local storage in a lightweight, quota-safe format
  useEffect(() => {
    try {
      const lightweightCart = serializeCartForStorage(cart);
      localStorage.setItem('my_cart_items', JSON.stringify(lightweightCart));
    } catch (e) {
      console.warn('Error al guardar carrito en storage, aplicando modo ultra-compacto:', e);
      try {
        // Fallback: minimal cart without images if local storage is nearing quota
        const ultraCompact = cart.map((item) => ({
          id: item.id,
          productId: item.productId,
          selectedColor: item.selectedColor,
          selectedSizeVariant: item.selectedSizeVariant,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          isWholesale: item.isWholesale,
          totalPrice: item.totalPrice,
          product: {
            id: item.product?.id || item.productId,
            title: item.product?.title || '',
            category: item.product?.category || '',
            images: [],
            minWholesaleQty: item.product?.minWholesaleQty || 1,
            wholesalePrice: item.product?.wholesalePrice || item.unitPrice,
            retailPrice: item.product?.retailPrice || item.unitPrice,
            stock: item.product?.stock || 99,
          },
        }));
        localStorage.setItem('my_cart_items', JSON.stringify(ultraCompact));
      } catch (fallbackErr) {
        console.warn('Almacenamiento local lleno, el carrito se mantendrá en memoria de sesión.', fallbackErr);
      }
    }
  }, [cart]);

  // Load products & categories from Supabase / local
  const loadData = async () => {
    try {
      const [prods, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(prods);
      setCategories(cats);
    } catch (e) {
      console.error('Error loading initial data:', e);
    }
  };

  // Hydrate cart items with complete product data once products are loaded
  useEffect(() => {
    if (products.length > 0 && cart.length > 0) {
      setCart((prevCart) => {
        let hasChanges = false;
        const hydrated = prevCart.map((cartItem) => {
          const matchingProduct = products.find((p) => p.id === cartItem.productId);
          if (matchingProduct) {
            // Find updated sizeVariant if applicable
            let updatedSizeVariant = cartItem.selectedSizeVariant;
            if (cartItem.selectedSizeVariant && matchingProduct.sizeVariants) {
              const matchedSv = matchingProduct.sizeVariants.find(
                (sv) =>
                  sv.id === cartItem.selectedSizeVariant?.id ||
                  sv.name.toLowerCase() === cartItem.selectedSizeVariant?.name.toLowerCase()
              );
              if (matchedSv) {
                updatedSizeVariant = matchedSv;
              }
            }

            // Ensure selectedImage is preserved or recovered from variant gallery
            let resolvedImage = cartItem.selectedImage;
            if (!resolvedImage || resolvedImage.trim().length === 0) {
              if (cartItem.selectedVariants) {
                const variantImgs = getActiveVariantImages(matchingProduct, cartItem.selectedVariants);
                if (variantImgs && variantImgs.length > 0) {
                  resolvedImage = variantImgs[0];
                }
              }
              if (!resolvedImage) {
                resolvedImage = matchingProduct.images?.[0] || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';
              }
            }

            // Recompute unit price from updated product data and exact variant choices
            const wholesaleUnitPrice = getItemEffectiveNormalPrice(
              matchingProduct,
              cartItem.selectedVariants,
              updatedSizeVariant,
              true
            );
            const retailUnitPrice = getItemEffectiveNormalPrice(
              matchingProduct,
              cartItem.selectedVariants,
              updatedSizeVariant,
              false
            );
            const unitPrice = cartItem.isWholesale ? wholesaleUnitPrice : retailUnitPrice;
            const totalPrice = unitPrice * cartItem.quantity;

            hasChanges = true;
            return {
              ...cartItem,
              product: matchingProduct,
              selectedSizeVariant: updatedSizeVariant,
              selectedImage: resolvedImage,
              unitPrice,
              totalPrice,
            };
          }
          return cartItem;
        });
        return hasChanges ? hydrated : prevCart;
      });
    }
  }, [products]);

  useEffect(() => {
    loadData();

    // Listen to URL changes (e.g. user types /admin or changes hash)
    const handleLocationChange = () => {
      if (window.location.pathname.includes('/admin') || window.location.hash.includes('admin')) {
        setView('admin');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Cart operations
  const handleAddToCart = (
    product: Product,
    selectedColor?: string,
    selectedSizeVariant?: SizeVariant,
    quantity: number = 1,
    selectedImage?: string,
    selectedVariants?: Record<string, string>,
    showNotification: boolean = true
  ) => {
    // Generate unique composite key based on product + selected variants
    const variantSuffix = selectedVariants
      ? Object.entries(selectedVariants)
          .map(([k, v]) => `${k}:${v}`)
          .sort()
          .join('|')
      : `${selectedColor || 'none'}-${selectedSizeVariant?.id || 'none'}`;

    const itemKey = `${product.id}-${variantSuffix}`;
    const maxAvailableStock = getSelectedVariantStock(product, selectedVariants || {});

    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.id === itemKey);
      if (existingIdx !== -1) {
        const updated = [...prev];
        let targetQty = updated[existingIdx].quantity + quantity;
        if (maxAvailableStock > 0 && targetQty > maxAvailableStock) {
          targetQty = maxAvailableStock;
        }
        updated[existingIdx].quantity = targetQty;
        if (selectedImage) updated[existingIdx].selectedImage = selectedImage;
        return updated;
      } else {
        const wholesaleUnitPrice = getItemEffectiveNormalPrice(
          product,
          selectedVariants,
          selectedSizeVariant,
          true
        );

        const resolvedImage = selectedImage || product.images[0] || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';

        const finalQty = maxAvailableStock > 0 ? Math.min(quantity, maxAvailableStock) : quantity;

        const newItem: CartItem = {
          id: itemKey,
          productId: product.id,
          product,
          selectedColor,
          selectedSizeVariant,
          selectedVariants,
          selectedImage: resolvedImage,
          quantity: finalQty,
          unitPrice: wholesaleUnitPrice,
          isWholesale: true,
          totalPrice: wholesaleUnitPrice * finalQty,
        };
        return [...prev, newItem];
      }
    });

    if (showNotification) {
      // Format human-readable variant summary for the top notification
      const wholesaleUnitPrice = getItemEffectiveNormalPrice(
        product,
        selectedVariants,
        selectedSizeVariant,
        true
      );
      const resolvedImage = selectedImage || product.images[0] || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';
      const finalQty = maxAvailableStock > 0 ? Math.min(quantity, maxAvailableStock) : quantity;

      let variantSummary = '';
      if (selectedVariants && Object.keys(selectedVariants).length > 0) {
        const uniqueVals: string[] = [];
        Object.entries(selectedVariants).forEach(([, v]) => {
          if (v && !uniqueVals.some((item) => item.toLowerCase() === v.toLowerCase())) {
            uniqueVals.push(v);
          }
        });
        variantSummary = uniqueVals.join(' • ');
      } else if (selectedColor || selectedSizeVariant) {
        variantSummary = [selectedColor, selectedSizeVariant?.name].filter(Boolean).join(' • ');
      }

      setCartNotification({
        id: `${Date.now()}-${Math.random()}`,
        product,
        variantSummary,
        quantity: finalQty,
        unitPrice: wholesaleUnitPrice,
        totalPrice: wholesaleUnitPrice * finalQty,
        image: resolvedImage,
      });
    }
  };

  const handleBuyNow = (
    product: Product,
    selectedColor?: string,
    selectedSizeVariant?: SizeVariant,
    quantity: number = 1,
    selectedImage?: string,
    selectedVariants?: Record<string, string>
  ) => {
    handleAddToCart(product, selectedColor, selectedSizeVariant, quantity, selectedImage, selectedVariants, false);
    setCartNotification(null);
    setView('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateCartQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const maxStock = getSelectedVariantStock(item.product, item.selectedVariants || {});
            let newQty = item.quantity + delta;
            if (maxStock > 0 && delta > 0 && newQty > maxStock) {
              newQty = maxStock;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveCartItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSetCartItemQuantity = (
    product: Product,
    selectedVariants: Record<string, string>,
    selectedImage: string,
    targetQty: number
  ) => {
    const variantIdPart =
      selectedVariants && Object.keys(selectedVariants).length > 0
        ? Object.entries(selectedVariants)
            .map(([k, v]) => `${k}:${v}`)
            .sort()
            .join('|')
        : 'none-none';
    const itemId = `${product.id}-${variantIdPart}`;
    const maxAvailableStock = getSelectedVariantStock(product, selectedVariants || {});

    if (targetQty <= 0) {
      handleRemoveCartItem(itemId);
      return;
    }

    const finalQty = maxAvailableStock > 0 ? Math.min(targetQty, maxAvailableStock) : targetQty;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === itemId);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: finalQty,
          totalPrice: updated[existingIndex].unitPrice * finalQty,
        };
        return updated;
      } else {
        const wholesaleUnitPrice = getItemEffectiveNormalPrice(
          product,
          selectedVariants,
          undefined,
          true
        );
        const resolvedImage = selectedImage || product.images[0] || 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800';
        const newItem: CartItem = {
          id: itemId,
          productId: product.id,
          product,
          selectedVariants,
          selectedImage: resolvedImage,
          quantity: finalQty,
          unitPrice: wholesaleUnitPrice,
          isWholesale: true,
          totalPrice: wholesaleUnitPrice * finalQty,
        };
        return [...prev, newItem];
      }
    });
  };

  const handleSelectDeliveryOption = (option: 'pickup' | 'delivery') => {
    setDeliveryOption(option);
    try {
      localStorage.setItem('my_commerce_checkout_delivery_option', option);
    } catch (e) {}
    if (option === 'delivery') {
      setPaymentMethod('transfer');
      try {
        localStorage.setItem('my_commerce_checkout_payment_method', 'transfer');
      } catch (e) {}
    }
  };

  const handleSelectPaymentMethod = (method: 'transfer' | 'cash') => {
    setPaymentMethod(method);
    try {
      localStorage.setItem('my_commerce_checkout_payment_method', method);
    } catch (e) {}
  };

  const handleSaveOrderToSupabaseAndEmail = async (orderPayload: any): Promise<Order> => {
    // 1. Save to Supabase (and local storage)
    const savedOrder = await saveOrder(orderPayload);

    // 2. Deduct stock according to independent variant vs shared inventory rules
    try {
      if (savedOrder.items && savedOrder.items.length > 0) {
        const updatedProds: Product[] = [];
        for (const item of savedOrder.items) {
          const currentProd = products.find((p) => p.id === item.productId);
          if (currentProd) {
            const cartMatch = cart.find((c) => c.productId === item.productId || c.id === item.id);
            const selectedVariants = cartMatch?.selectedVariants || {};
            const updatedProd = deductStockFromProduct(
              currentProd,
              item.quantity,
              selectedVariants,
              cartMatch?.selectedSizeVariant
            );

            await updateProduct(updatedProd.id, {
              stock: updatedProd.stock,
              soldCount: updatedProd.soldCount,
              variantTypes: updatedProd.variantTypes,
              sizeVariants: updatedProd.sizeVariants,
            });
            updatedProds.push(updatedProd);
          }
        }

        if (updatedProds.length > 0) {
          setProducts((prev) =>
            prev.map((p) => {
              const u = updatedProds.find((up) => up.id === p.id);
              return u || p;
            })
          );
        }
      }
    } catch (err) {
      console.warn('Error updating inventory stock after order save:', err);
    }

    // 3. Send email via EmailJS (customer receipt + admin notification)
    try {
      const emailResult = await sendOrderEmails(savedOrder);
      savedOrder.emailSentToCustomer = emailResult.customerSuccess;
      savedOrder.emailSentToAdmin = emailResult.adminSuccess;
      await updateOrderEmailStatus(savedOrder.id, emailResult.customerSuccess, emailResult.adminSuccess);
    } catch (e) {
      console.warn('Error sending emails with EmailJS:', e);
    }

    return savedOrder;
  };

  const handleOrderCompleted = (order: Order) => {
    setLastOrder(order);
    setCart([]); // Clear cart
    setView('confirmation');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigations
  const handleSelectProduct = (
    product: Product,
    initialVariants?: Record<string, string>,
    initialImage?: string
  ) => {
    setCartNotification(null);
    setSelectedProduct(product);
    setSelectedProductVariants(initialVariants);
    setSelectedProductImage(initialImage);
    setPreviousView(view === 'cart' ? 'cart' : (currentCategory && currentCategory !== 'Todo' ? 'category' : 'home'));
    setView('product_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setCartNotification(null);
    setView('home');
    setLastShoppingView('home');
    setSelectedProduct(null);
    setSelectedProductVariants(undefined);
    setSelectedProductImage(undefined);
    setCurrentCategory('Todo');
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToQuickBuy = () => {
    setCartNotification(null);
    setView('quick_buy');
    setLastShoppingView('quick_buy');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToCart = () => {
    setCartNotification(null);
    setView('cart');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenInfoPage = (sectionId: string) => {
    setCartNotification(null);
    setTargetInfoSection(sectionId);
    if (view !== 'info') {
      setView('info');
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleExitAdmin = () => {
    window.history.pushState(null, '', '/');
    setView('home');
    loadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Render Admin View if on /admin
  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-[#fbf9f8] text-[#1b1c1c] font-sans antialiased">
        <AdminView onExitAdmin={handleExitAdmin} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f8] text-[#1b1c1c] font-sans antialiased">
      {/* Global Navigation Header (Royal Blue) */}
      <Navbar
        showTopBar={view === 'home' || view === 'category'}
        currentCategory={currentCategory}
        categories={categories}
        onSelectCategory={(cat) => {
          setCartNotification(null);
          setCurrentCategory(cat);
          if (cat === 'Todo') {
            setView('home');
            setLastShoppingView('home');
          } else {
            setView('category');
            setLastShoppingView('category');
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (view !== 'home' && view !== 'category' && q.trim()) setView('home');
        }}
        cartItems={cart}
        onOpenCart={handleGoToCart}
        onGoHome={handleGoHome}
        onOpenQuickBuy={handleGoToQuickBuy}
        isQuickBuyActive={view === 'quick_buy'}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenAccount={() => setIsAccountModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {view === 'quick_buy' && (
          <QuickBuyView
            products={products}
            categories={categories}
            cartItems={cart}
            deliveryOption={deliveryOption}
            onSelectDeliveryOption={handleSelectDeliveryOption}
            paymentMethod={paymentMethod}
            onSelectPaymentMethod={handleSelectPaymentMethod}
            onAddToCart={(prod, col, sz, qty, img, vars) =>
              handleAddToCart(prod, col, sz, qty, img, vars, false)
            }
            onUpdateCartQuantity={handleUpdateCartQuantity}
            onSetCartItemQuantity={handleSetCartItemQuantity}
            onRemoveCartItem={handleRemoveCartItem}
            onOpenCart={handleGoToCart}
            onGoToHome={() => {
              setView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onProceedToCheckout={() => {
              setView('checkout');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectProductDetail={(prod, variants, img) => {
              setPreviousView('quick_buy');
              handleSelectProduct(prod, variants, img);
            }}
          />
        )}

        {view === 'home' && (
          <HomeView
            products={products}
            categories={categories}
            onSelectProduct={handleSelectProduct}
            onSelectCategory={(cat) => {
              setCurrentCategory(cat);
              if (cat === 'Todo') {
                setView('home');
                setLastShoppingView('home');
                window.scrollTo({ top: 300, behavior: 'smooth' });
              } else {
                setView('category');
                setLastShoppingView('category');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            currentCategory={currentCategory}
            searchQuery={searchQuery}
          />
        )}

        {view === 'category' && (
          <CategoryView
            categoryName={currentCategory}
            products={products}
            categories={categories}
            onSelectProduct={handleSelectProduct}
            onBack={handleGoHome}
            onSelectCategory={(cat) => {
              if (cat === 'Todo') {
                setCurrentCategory('Todo');
                setView('home');
                setLastShoppingView('home');
              } else {
                setCurrentCategory(cat);
                setLastShoppingView('category');
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {view === 'product_detail' && selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            allProducts={products}
            initialSelectedVariants={selectedProductVariants}
            initialSelectedImage={selectedProductImage}
            backLabel={
              previousView === 'quick_buy'
                ? 'Volver a Compra Rápida'
                : previousView === 'cart'
                ? 'Volver al carrito'
                : undefined
            }
            onBack={() => {
              setCartNotification(null);
              if (previousView === 'quick_buy') {
                setView('quick_buy');
              } else if (previousView === 'cart') {
                setView('cart');
              } else if (currentCategory && currentCategory !== 'Todo') {
                setView('category');
              } else {
                setView('home');
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onGoToCart={handleGoToCart}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            onSelectRelated={handleSelectProduct}
          />
        )}

        {view === 'cart' && (
          <CartView
            cartItems={cart}
            onSelectProduct={handleSelectProduct}
            onSelectCategory={(cat) => {
              setCurrentCategory(cat);
              if (cat === 'Todo') {
                setView('home');
              } else {
                setView('category');
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveCartItem}
            onProceedToCheckout={() => {
              setView('checkout');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onContinueShopping={() => {
              if (lastShoppingView === 'quick_buy') {
                handleGoToQuickBuy();
              } else {
                handleGoHome();
              }
            }}
          />
        )}

        {view === 'checkout' && (
          <CheckoutView
            cartItems={cart}
            currentUser={currentUser}
            onAuthSuccess={(profile) => setCurrentUser(profile)}
            initialDeliveryOption={deliveryOption}
            initialPaymentMethod={paymentMethod}
            onDeliveryOptionChange={handleSelectDeliveryOption}
            onPaymentMethodChange={handleSelectPaymentMethod}
            onBackToCart={() => {
              setView('cart');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOrderCompleted={handleOrderCompleted}
            onSaveOrderToSupabaseAndEmail={handleSaveOrderToSupabaseAndEmail}
          />
        )}

        {view === 'confirmation' && lastOrder && (
          <OrderConfirmationView
            order={lastOrder}
            onContinueShopping={() => {
              if (lastShoppingView === 'quick_buy') {
                handleGoToQuickBuy();
              } else {
                handleGoHome();
              }
            }}
          />
        )}

        {view === 'info' && (
          <InfoPageView
            targetSection={targetInfoSection}
            onGoHome={handleGoHome}
            onOpenQuickBuy={handleGoToQuickBuy}
          />
        )}
      </main>

      {/* Footer (oculto en la página de compra rápida) */}
      {view !== 'quick_buy' && <Footer onNavigateToInfo={handleOpenInfoPage} />}

      {/* Mobile-only Orientation Lock */}
      <MobileOrientationLock />

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(profile) => {
          setCurrentUser(profile);
          setIsAuthModalOpen(false);
        }}
      />

      {/* Global User Account Modal */}
      {currentUser && (
        <AccountModal
          isOpen={isAccountModalOpen}
          onClose={() => setIsAccountModalOpen(false)}
          profile={currentUser}
          onUpdateProfile={(updated) => setCurrentUser(updated)}
          onLogout={() => {
            setCurrentUser(null);
            setIsAccountModalOpen(false);
          }}
        />
      )}

      {/* Top Added-To-Cart Toast Notification (active only on product_detail view) */}
      {view === 'product_detail' && (
        <AddedToCartNotification
          data={cartNotification}
          onClose={() => setCartNotification(null)}
          onGoToCart={handleGoToCart}
        />
      )}
    </div>
  );
}
