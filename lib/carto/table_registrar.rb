module Carto
  class TableRegistrar
    def initialize(user_id:, table_name:, dataset_visualization: nil)
      @user_id = user_id
      @table_name = table_name
      @dataset_visualization = dataset_visualization
    end

    def register
      table = build_table

      if @dataset_visualization
        copy_visualization_metedata_to_table(@dataset_visualization, table)
      end

      table.save
      table.optimize
      table.update_bounding_box
      table.map.recalculate_bounds!

      table
    end

    private

    def build_table
      table = Table.new
      table.user_id = @user_id

      # TODO: remember to set the Table class name in a sounder way once Table
      # has been refactored.
      table.instance_eval { self[:name] = @table_name }

      table.migrate_existing_table = @table_name
      table
    end

    def copy_dataset_visualization_metedata_to_table(dataset_visualization, table)
      table.description = dataset_visualization.description
      table.set_tag_array(dataset_visualization.tags)
    end
  end
end
