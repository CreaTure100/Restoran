import React from 'react';
import KitchenPanel from '../components/KitchenPanel';

const KitchenPage = ({queue, onStartCooking, onComplete, onViewRecipe}) => {
    return (
        <KitchenPanel
            queue={queue}
            onStartCooking={onStartCooking}
            onComplete={onComplete}
            onViewRecipe={onViewRecipe}
            onBack={() => window.location.href = '/'}    
        />
    )
};
export default KitchenPage;